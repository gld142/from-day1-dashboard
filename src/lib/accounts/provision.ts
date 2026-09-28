import type Stripe from "stripe";
import { adminDb } from "@/lib/supabase/admin";
import { paidArtists, periodEnd, stripe } from "@/lib/billing/stripe";
import { accessEndsAt } from "./manage";
import { ensureUser } from "./users";

export type Workspace = {
  id: string;
  name: string;
  kind: string;
  owner_created_by_checkout: boolean;
  owner_autologin_at: string | null;
  artist_quantity: number;
  subscription_status: string;
  stripe_subscription_id: string | null;
};

/**
 * Paiement confirmé → compte + espace + propriétaire. Idempotent : la page de
 * retour et le webhook Stripe peuvent l'appeler tous les deux, dans n'importe
 * quel ordre ; un paiement ne crée jamais deux espaces.
 */
export async function provisionFromCheckout(sessionId: string): Promise<Workspace & { ownerEmail: string }> {
  const db = adminDb();
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.status !== "complete") throw new Error(`paiement non terminé (${session.status})`);
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  if (!email) throw new Error("paiement sans email");

  const existing = await db.from("workspaces").select().eq("stripe_checkout_session_id", sessionId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { ...(existing.data as Workspace), ownerEmail: email };

  const leadId = session.metadata?.lead_id ?? null;
  const lead = leadId
    ? (await db.from("leads").select("first_name, last_name, company, profile, siret").eq("id", leadId).maybeSingle()).data
    : null;
  const person = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ");
  const { userId, created } = await ensureUser(email, person ? { full_name: person } : {});

  const sub = session.subscription as Stripe.Subscription;
  const companyName = session.customer_details?.business_name?.trim() || null;
  const siret: string | null = lead?.siret ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  // Factures entre professionnels : la raison sociale comme nom du client (le
  // SIRET y est déjà, posé avant le paiement — voir /api/checkout).
  if (customerId && companyName) await stripe().customers.update(customerId, { name: companyName });
  const inserted = await db
    .from("workspaces")
    .insert({
      name: lead?.company || companyName || person || email,
      company_name: companyName,
      siret,
      kind: lead?.profile ?? "other",
      lead_id: leadId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_checkout_session_id: sessionId,
      subscription_status: sub.status,
      artist_quantity: paidArtists(sub),
      current_period_end: periodEnd(sub),
      owner_created_by_checkout: created,
    })
    .select()
    .single();
  // Course avec l'autre appel (webhook / page de retour) : il a créé l'espace, on le relit.
  if (inserted.error?.code === "23505") return provisionFromCheckout(sessionId);
  if (inserted.error) throw inserted.error;
  const workspace = inserted.data as Workspace;

  const member = await db
    .from("workspace_members")
    .upsert({ workspace_id: workspace.id, user_id: userId, email, role: "owner" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
  if (member.error) throw member.error;
  if (leadId) await db.from("leads").update({ stage: "paid" }).eq("id", leadId);
  return { ...workspace, ownerEmail: email };
}

/** Réserve la connexion automatique du propriétaire : une seule fois, et seulement pour un compte créé par ce paiement. */
export async function claimOwnerAutologin(workspaceId: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("workspaces")
    .update({ owner_autologin_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .eq("owner_created_by_checkout", true)
    .is("owner_autologin_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length === 1;
}

/** Stripe a changé l'abonnement (quantité, statut, fin) : on recopie ce qui sert à l'app. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const { error } = await adminDb()
    .from("workspaces")
    .update({
      subscription_status: sub.status,
      artist_quantity: paidArtists(sub),
      current_period_end: periodEnd(sub),
      cancel_at: accessEndsAt({ cancel_at: sub.cancel_at, cancel_at_period_end: sub.cancel_at_period_end, periodEnd: periodEnd(sub) }),
    })
    .eq("stripe_subscription_id", sub.id);
  if (error) throw error;
}
