"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncSubscription } from "@/lib/accounts/provision";
import { appUrl } from "@/lib/app-url";
import { inviteEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { confirmMatches, quantityAfterRemoval } from "@/lib/accounts/manage";
import { portalConfigurationId, priceId, stripe } from "@/lib/billing/stripe";
import { isEmail } from "@/lib/onboarding/lead";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";

export type FormState = { status: "idle" | "ok" | "error" | "upgrade"; message?: string; link?: string; emailed?: boolean };

/** L'utilisateur connecté est-il propriétaire de cet espace ? (lu avec SA session : RLS) */
async function ownerOf(workspaceId: string) {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/connexion");
  const { data: m } = await db
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  return m?.role === "owner" ? data.user : null;
}

export async function addArtist(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { status: "error", message: "Donne un nom à l'artiste." };
  const user = await ownerOf(workspaceId);
  if (!user) return { status: "error", message: "Seul le propriétaire de l'espace peut ajouter un artiste." };

  const db = adminDb();
  const { data: ws } = await db.from("workspaces").select("artist_quantity, stripe_subscription_id").eq("id", workspaceId).single();
  const { count } = await db.from("artists").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (!ws) return { status: "error", message: "Espace introuvable." };

  if ((count ?? 0) >= ws.artist_quantity) {
    // Au-delà des artistes payés : il faut l'accord explicite, puis Stripe ajoute 39 €/mois (au prorata).
    if (form.get("confirmExtra") !== "1") return { status: "upgrade" };
    if (!ws.stripe_subscription_id) return { status: "error", message: "Aucun abonnement actif." };
    try {
      const s = stripe();
      const sub = await s.subscriptions.retrieve(ws.stripe_subscription_id);
      const extra = await priceId("extraArtist");
      const item = sub.items.data.find((i) => i.price.id === extra);
      if (item) await s.subscriptionItems.update(item.id, { quantity: (item.quantity ?? 0) + 1, proration_behavior: "create_prorations" });
      else await s.subscriptionItems.create({ subscription: sub.id, price: extra, quantity: 1, proration_behavior: "create_prorations" });
      await syncSubscription(await s.subscriptions.retrieve(sub.id));
    } catch (err) {
      console.error("[espace/addArtist] stripe", err);
      return { status: "error", message: "L'abonnement n'a pas pu être augmenté. Rien n'a été facturé." };
    }
  }

  const { error } = await db.from("artists").insert({ workspace_id: workspaceId, name });
  if (error) {
    console.error("[espace/addArtist]", error);
    return { status: "error", message: "L'artiste n'a pas pu être ajouté." };
  }
  revalidatePath("/espace");
  return { status: "ok" };
}

export async function createInvitation(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "artist" ? "artist" : "member";
  const artistId = role === "artist" ? String(form.get("artistId") ?? "") : null;
  if (!isEmail(email)) return { status: "error", message: "Cet email ne semble pas valide." };
  const user = await ownerOf(workspaceId);
  if (!user) return { status: "error", message: "Seul le propriétaire de l'espace peut inviter." };

  const db = adminDb();
  if (artistId) {
    const { data: a } = await db.from("artists").select("id").eq("id", artistId).eq("workspace_id", workspaceId).maybeSingle();
    if (!a) return { status: "error", message: "Choisis l'artiste concerné." };
  }
  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("invitations").insert({
    workspace_id: workspaceId,
    email,
    role,
    artist_id: artistId,
    token_hash: createHash("sha256").update(token).digest("hex"),
    created_by: user.id,
  });
  if (error) {
    console.error("[espace/createInvitation]", error);
    return { status: "error", message: "L'invitation n'a pas pu être créée." };
  }
  revalidatePath("/espace");
  const link = appUrl(`/invitation/${token}`);
  // L'email part tout seul ; le lien reste affiché pour l'envoyer aussi à la main si besoin.
  const { data: ws } = await db.from("workspaces").select("name").eq("id", workspaceId).single();
  let emailed = true;
  try {
    await sendEmail(inviteEmail(email, link, ws?.name ?? "Day 1 Pro", role));
  } catch (err) {
    console.error("[espace/createInvitation] email", err);
    emailed = false;
  }
  return { status: "ok", link, message: email, emailed };
}

export async function signOut() {
  await (await userDb()).auth.signOut();
  redirect("/connexion");
}

/* ─────────── Abonnement : portail client Stripe (carte, factures, résiliation) ─────────── */

export async function openBillingPortal(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const user = await ownerOf(workspaceId);
  if (!user) redirect("/espace");
  const { data: ws } = await adminDb().from("workspaces").select("stripe_customer_id").eq("id", workspaceId).single();
  if (!ws?.stripe_customer_id) redirect("/espace?portail=indisponible");
  let url: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: ws.stripe_customer_id,
      configuration: await portalConfigurationId(),
      return_url: appUrl("/espace/abonnement/retour"),
      locale: "fr",
    });
    url = session.url;
  } catch (err) {
    console.error("[espace/openBillingPortal]", err);
    redirect("/espace?portail=indisponible");
  }
  redirect(url);
}

/* ─────────── Artistes ─────────── */

export async function renameArtist(_: FormState, form: FormData): Promise<FormState> {
  const artistId = String(form.get("artistId") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { status: "error", message: "Donne un nom à l'artiste." };
  const { data: artist } = await adminDb().from("artists").select("workspace_id").eq("id", artistId).maybeSingle();
  if (!artist || !(await ownerOf(artist.workspace_id))) return { status: "error", message: "Seul le propriétaire de l'espace peut renommer un artiste." };
  const { error } = await adminDb().from("artists").update({ name }).eq("id", artistId).eq("workspace_id", artist.workspace_id);
  if (error) {
    console.error("[espace/renameArtist]", error);
    return { status: "error", message: "L'artiste n'a pas pu être renommé." };
  }
  revalidatePath("/espace");
  return { status: "ok" };
}

/**
 * Retire un artiste ET toutes ses données (relevés, contrats, splits, droits,
 * dépenses, accès « artiste »). Confirmé en retapant son nom. Retire aussi une
 * place payée (sauf la place incluse), au prorata.
 */
export async function removeArtist(_: FormState, form: FormData): Promise<FormState> {
  const artistId = String(form.get("artistId") ?? "");
  const db = adminDb();
  const { data: artist } = await db.from("artists").select("name, workspace_id").eq("id", artistId).maybeSingle();
  if (!artist || !(await ownerOf(artist.workspace_id))) return { status: "error", message: "Seul le propriétaire de l'espace peut retirer un artiste." };
  if (!confirmMatches(String(form.get("confirm") ?? ""), artist.name)) return { status: "error", message: `Retape « ${artist.name} » pour confirmer.` };

  const { data: ws } = await db.from("workspaces").select("artist_quantity, stripe_subscription_id").eq("id", artist.workspace_id).single();
  if (ws?.stripe_subscription_id && ws.artist_quantity > 1) {
    try {
      const s = stripe();
      const extra = await priceId("extraArtist");
      const sub = await s.subscriptions.retrieve(ws.stripe_subscription_id);
      const item = sub.items.data.find((i) => i.price.id === extra);
      const next = quantityAfterRemoval(ws.artist_quantity) - 1; // places « en plus » après retrait
      if (item) {
        if (next > 0) await s.subscriptionItems.update(item.id, { quantity: next, proration_behavior: "create_prorations" });
        else await s.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
      }
      await syncSubscription(await s.subscriptions.retrieve(sub.id));
    } catch (err) {
      console.error("[espace/removeArtist] stripe", err);
      return { status: "error", message: "L'abonnement n'a pas pu être ajusté : l'artiste n'a pas été retiré." };
    }
  }
  const { error } = await db.from("artists").delete().eq("id", artistId).eq("workspace_id", artist.workspace_id);
  if (error) {
    console.error("[espace/removeArtist]", error);
    return { status: "error", message: "L'artiste n'a pas pu être retiré." };
  }
  revalidatePath("/espace");
  return { status: "ok" };
}

/* ─────────── Équipe ─────────── */

/** Supprime un compte qui n'est plus membre d'aucun espace (minimisation des données). */
async function deleteUserIfOrphan(userId: string) {
  const db = adminDb();
  const { count } = await db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) === 0) await db.auth.admin.deleteUser(userId);
}

export async function removeMember(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const userId = String(form.get("userId") ?? "");
  const owner = await ownerOf(workspaceId);
  if (!owner) return { status: "error", message: "Seul le propriétaire de l'espace peut retirer un membre." };
  if (userId === owner.id) return { status: "error", message: "Le propriétaire ne peut pas se retirer lui-même." };
  const db = adminDb();
  const { data: removed, error } = await db.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId).neq("role", "owner").select("user_id");
  if (error || !removed?.length) {
    if (error) console.error("[espace/removeMember]", error);
    return { status: "error", message: "Ce membre n'a pas pu être retiré." };
  }
  await deleteUserIfOrphan(userId);
  revalidatePath("/espace");
  return { status: "ok" };
}

export async function revokeInvitation(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const invitationId = String(form.get("invitationId") ?? "");
  if (!(await ownerOf(workspaceId))) return { status: "error", message: "Seul le propriétaire de l'espace peut annuler une invitation." };
  const { data, error } = await adminDb().from("invitations").delete().eq("id", invitationId).eq("workspace_id", workspaceId).is("accepted_at", null).select("id");
  if (error || !data?.length) return { status: "error", message: "Cette invitation n'a pas pu être annulée." };
  revalidatePath("/espace");
  return { status: "ok" };
}

/* ─────────── Quitter / supprimer ─────────── */

/** Un membre (équipe ou artiste invité) quitte l'espace ; son compte est supprimé s'il n'est plus nulle part. */
export async function leaveWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/connexion");
  const { data: removed } = await adminDb().from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", data.user.id).neq("role", "owner").select("user_id");
  if (!removed?.length) return { status: "error", message: "Impossible de quitter cet espace (le propriétaire le supprime au lieu de le quitter)." };
  await db.auth.signOut();
  await deleteUserIfOrphan(data.user.id);
  redirect("/connexion?compte=quitte");
}

/**
 * Le propriétaire supprime l'espace : abonnement arrêté tout de suite (pas de
 * nouvelle échéance), TOUTES les données effacées (artistes, relevés, contrats,
 * splits, droits, dépenses, équipe, invitations, fiche d'inscription), comptes
 * devenus orphelins supprimés. Les factures restent chez Stripe (obligation de
 * conservation). Confirmé en retapant le nom de l'espace.
 */
export async function deleteWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const owner = await ownerOf(workspaceId);
  if (!owner) return { status: "error", message: "Seul le propriétaire peut supprimer l'espace." };
  const db = adminDb();
  const { data: ws } = await db.from("workspaces").select("name, stripe_subscription_id, lead_id").eq("id", workspaceId).single();
  if (!ws) return { status: "error", message: "Espace introuvable." };
  if (!confirmMatches(String(form.get("confirm") ?? ""), ws.name)) return { status: "error", message: `Retape « ${ws.name} » pour confirmer.` };

  if (ws.stripe_subscription_id) {
    try {
      const sub = await stripe().subscriptions.retrieve(ws.stripe_subscription_id);
      if (sub.status !== "canceled") await stripe().subscriptions.cancel(sub.id);
    } catch (err) {
      console.error("[espace/deleteWorkspace] stripe", err);
      return { status: "error", message: "L'abonnement n'a pas pu être arrêté : rien n'a été supprimé." };
    }
  }
  const { data: members } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  const { error } = await db.from("workspaces").delete().eq("id", workspaceId);
  if (error) {
    console.error("[espace/deleteWorkspace]", error);
    return { status: "error", message: "L'espace n'a pas pu être supprimé." };
  }
  if (ws.lead_id) await db.from("leads").delete().eq("id", ws.lead_id);
  await (await userDb()).auth.signOut();
  for (const m of members ?? []) await deleteUserIfOrphan(m.user_id);
  redirect("/connexion?compte=supprime");
}
