import { NextResponse, type NextRequest } from "next/server";
import { ARTIST_COOKIE, customerView } from "@/lib/accounts/customer";
import { returnPath } from "@/lib/nav";
import { userDb } from "@/lib/supabase/server";

/**
 * Ouvre le dashboard sur un artiste — seulement s'il est visible pour cette
 * session (RLS) — puis revient sur la page demandée (`vers`), si elle est
 * ouverte à ce rôle. Le cookie est posé APRÈS la relecture de la vue :
 * `customerView` lit le cookie de la requête, on lui passe donc l'artiste
 * explicitement.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await ctx.params;
  const db = await userDb();
  const { data } = await db.from("artists").select("id, workspace_id").eq("id", artistId).maybeSingle();
  if (!data) return NextResponse.redirect(new URL("/espace", request.url));
  const view = await customerView(data.id);
  const to = view.kind === "customer" ? returnPath(request.nextUrl.searchParams.get("vers"), view.info.role, view.info.view) : "/espace";
  const res = NextResponse.redirect(new URL(to, request.url));
  res.cookies.set(ARTIST_COOKIE, data.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
