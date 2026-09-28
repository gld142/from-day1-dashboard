import { NextResponse, type NextRequest } from "next/server";
import { ARTIST_COOKIE } from "@/lib/accounts/customer";
import { CUSTOMER_HOME } from "@/lib/nav";
import { userDb } from "@/lib/supabase/server";

/** Ouvre le dashboard sur un artiste — seulement s'il est visible pour cette session (RLS). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await ctx.params;
  const { data } = await (await userDb()).from("artists").select("id").eq("id", artistId).maybeSingle();
  if (!data) return NextResponse.redirect(new URL("/espace", request.url));
  const to = request.nextUrl.searchParams.get("vers") === "import" ? "/import" : CUSTOMER_HOME;
  const res = NextResponse.redirect(new URL(to, request.url));
  res.cookies.set(ARTIST_COOKIE, data.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
