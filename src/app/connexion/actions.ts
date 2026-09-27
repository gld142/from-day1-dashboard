"use server";

import { headers } from "next/headers";
import { isEmail } from "@/lib/onboarding/lead";
import { userDb } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

/**
 * Envoie un lien de connexion par email. Même réponse que le compte existe ou
 * non : la page ne doit pas servir à deviner qui est client.
 */
export async function sendLoginLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { status: "error", message: "Cet email ne semble pas valide.", email };
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await (await userDb()).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error?.status === 429) {
    return { status: "error", message: "Trop de demandes d'affilée. Réessaie dans quelques minutes.", email };
  }
  if (error && error.status !== 422 && error.code !== "otp_disabled") {
    console.error("[connexion]", error);
    return { status: "error", message: "L'envoi n'a pas marché. Réessaie dans un instant.", email };
  }
  return { status: "sent", email };
}
