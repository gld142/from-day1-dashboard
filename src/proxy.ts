import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_PATH, isValidToken } from "@/lib/gate";

/** Toute page passe par la porte : sans le cookie, direction /acces (voir lib/gate). */
export async function proxy(request: NextRequest) {
  if (await isValidToken(request.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();
  const url = new URL(GATE_PATH, request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!acces|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
