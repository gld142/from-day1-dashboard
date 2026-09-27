import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ensureUser, signInOnResponse } from "@/lib/accounts/users";
import { adminDb } from "@/lib/supabase/admin";

/**
 * Lien d'invitation envoyé par le propriétaire d'un espace (7 jours, un seul usage).
 * Compte neuf : il est créé et connecté ici. Compte existant : l'invitation est
 * acceptée mais la personne doit prouver son email en se connectant.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const to = (path: string) => new URL(path, request.url);
  const hash = createHash("sha256").update(token).digest("hex");
  const db = adminDb();

  const { data: inv } = await db
    .from("invitations")
    .select("id, workspace_id, email, role, artist_id, expires_at, accepted_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) {
    return NextResponse.redirect(to("/connexion?invitation=invalide"));
  }

  // Un seul usage, même si le lien est ouvert deux fois en même temps.
  const claim = await db
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id)
    .is("accepted_at", null)
    .select("id");
  if (!claim.data?.length) return NextResponse.redirect(to("/connexion?invitation=invalide"));

  try {
    const { userId, created } = await ensureUser(inv.email);
    const member = await db.from("workspace_members").upsert(
      { workspace_id: inv.workspace_id, user_id: userId, email: inv.email, role: inv.role, artist_id: inv.artist_id },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );
    if (member.error) throw member.error;
    if (!created) {
      return NextResponse.redirect(to(`/connexion?invitation=ok&email=${encodeURIComponent(inv.email)}`));
    }
    const res = NextResponse.redirect(to("/espace?bienvenue=1"));
    await signInOnResponse(inv.email, request, res);
    return res;
  } catch (err) {
    console.error("[invitation]", err);
    await db.from("invitations").update({ accepted_at: null }).eq("id", inv.id); // on rend le lien réutilisable
    return NextResponse.redirect(to("/connexion?invitation=invalide"));
  }
}
