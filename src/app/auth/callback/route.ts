import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userDbFor } from "@/lib/supabase/server";

/** Arrivée depuis le lien de connexion reçu par email : ouvre la session puis va à l'espace. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const res = NextResponse.redirect(new URL("/espace", request.url));
  const auth = userDbFor(request, res).auth;
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const { error } = code
    ? await auth.exchangeCodeForSession(code)
    : tokenHash
      ? await auth.verifyOtp({ token_hash: tokenHash, type: (q.get("type") ?? "email") as EmailOtpType })
      : { error: new Error("lien incomplet") };
  if (error) return NextResponse.redirect(new URL("/connexion?lien=expire", request.url));
  return res;
}
