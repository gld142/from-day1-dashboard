import type { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { userDbFor } from "@/lib/supabase/server";

/**
 * Retrouve ou crée l'utilisateur Supabase de cet email.
 * `created` dit si le compte vient d'être créé ici : seul un compte neuf peut
 * être connecté automatiquement (sinon, payer ou inviter avec l'email de
 * quelqu'un d'autre donnerait accès à SON compte existant).
 */
export async function ensureUser(email: string, meta: Record<string, string> = {}) {
  const auth = adminDb().auth.admin;
  const { data, error } = await auth.createUser({ email, email_confirm: true, user_metadata: meta });
  if (data.user) return { userId: data.user.id, created: true };
  if (error && error.code !== "email_exists") throw error;
  const found = await auth.generateLink({ type: "magiclink", email });
  if (found.error || !found.data.user) throw found.error ?? new Error("utilisateur introuvable");
  return { userId: found.data.user.id, created: false };
}

/** Ouvre la session de `email` dans CE navigateur (cookies posés sur `response`), sans email. */
export async function signInOnResponse(email: string, request: NextRequest, response: NextResponse) {
  const link = await adminDb().auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const { error } = await userDbFor(request, response).auth.verifyOtp({
    type: "email",
    token_hash: link.data.properties.hashed_token,
  });
  if (error) throw error;
}
