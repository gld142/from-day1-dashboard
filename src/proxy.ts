import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GATE_COOKIE, GATE_PATH, isValidToken } from "@/lib/gate";

/** Parcours d'achat et API qui le servent : publics, pour des visiteurs pas encore clients. */
const PUBLIC = /^\/(acces|inscription|api\/leads|api\/checkout|api\/stripe)(\/|$)/;
/** Espace client : protégé par la connexion Supabase (vérifiée dans chaque page), pas par la porte. */
const ACCOUNT = /^\/(espace|connexion|auth|invitation)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.test(pathname)) return NextResponse.next();
  if (ACCOUNT.test(pathname)) return refreshSession(request);

  // Le dashboard (données de démo) reste derrière la porte à mot de passe (voir lib/gate).
  if (await isValidToken(request.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();
  const url = new URL(GATE_PATH, request.url);
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

/**
 * Rafraîchit la session Supabase (le jeton d'accès dure 1 h) : les Server
 * Components ne peuvent pas poser de cookie, c'est donc fait ici, avant eux.
 */
async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
