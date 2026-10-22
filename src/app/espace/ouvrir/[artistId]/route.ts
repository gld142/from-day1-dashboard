import { NextResponse, type NextRequest } from "next/server";
import { ARTIST_COOKIE, customerView } from "@/lib/accounts/customer";
import { returnPath } from "@/lib/nav";

/**
 * Ouvre le dashboard sur un artiste — seulement s'il est visible pour cette
 * session (RLS : `customerView` retombe sur le premier artiste visible quand
 * l'id demandé ne l'est pas, d'où la comparaison) — puis revient sur la page
 * demandée (`vers`) si elle est ouverte à ce rôle. Le cookie est posé après
 * le calcul de la vue, qui reçoit l'artiste explicitement.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await ctx.params;
  const view = await customerView(artistId);
  if (view.kind !== "customer" || view.info.artistId !== artistId) return NextResponse.redirect(new URL("/espace", request.url));
  const to = returnPath(request.nextUrl.searchParams.get("vers"), view.info.role, view.info.view);
  const res = NextResponse.redirect(new URL(to, request.url));
  res.cookies.set(ARTIST_COOKIE, artistId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
