"use server";

import { appUrl } from "@/lib/app-url";
import { loginEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { isEmail } from "@/lib/onboarding/lead";
import { adminDb } from "@/lib/supabase/admin";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

/** Un email de connexion par adresse et par minute (par instance serveur) : pas de boîte inondée. */
const lastSent = new Map<string, number>();

/**
 * Envoie un lien de connexion — seulement si l'email appartient à un membre d'un
 * espace. Même réponse dans tous les cas : la page ne sert pas à deviner qui est client.
 * Le lien est le nôtre (/auth/callback + jeton Supabase à usage unique) : aucun
 * réglage d'adresses de redirection à faire chez Supabase.
 */
export async function sendLoginLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { status: "error", message: "Cet email ne semble pas valide.", email };

  const now = Date.now();
  if (now - (lastSent.get(email) ?? 0) < 60_000) return { status: "sent", email };
  lastSent.set(email, now);

  try {
    const db = adminDb();
    const { data: member } = await db.from("workspace_members").select("user_id").eq("email", email).limit(1).maybeSingle();
    if (member) {
      const link = await db.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error) throw link.error;
      const url = appUrl(`/auth/callback?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=email`);
      await sendEmail(loginEmail(email, url));
    }
  } catch (err) {
    console.error("[connexion]", err);
    return { status: "error", message: "L'envoi n'a pas marché. Réessaie dans un instant.", email };
  }
  return { status: "sent", email };
}
