"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { syncSubscription } from "@/lib/accounts/provision";
import { inviteEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { priceId, stripe } from "@/lib/billing/stripe";
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
  const origin = (await headers()).get("origin") ?? "";
  const link = `${origin}/invitation/${token}`;
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
