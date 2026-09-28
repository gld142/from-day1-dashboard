import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GATE_COOKIE, GATE_PATH, isValidToken } from "@/lib/gate";

/** Parcours d'achat et API qui le servent : publics, pour des visiteurs pas encore clients. */
const PUBLIC = /^\/(acces|inscription|api\/leads|api\/checkout|api\/stripe)(\/|$)/;
/** Espace client : protégé par la connexion Supabase (vérifiée dans chaque page), pas par la porte. */
const ACCOUNT = /^\/(espace|connexion|auth|invitation|api\/imports)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.test(pathname)) return NextResponse.next();
  if (ACCOUNT.test(pathname)) return (await withSession(request)).response;

  // Dashboard : la démo derrière le mot de passe, OU un client connecté (le layout
  // choisit le mode et vérifie l'abonnement). Le chemin lui est transmis.
  if (await isValidToken(request.cookies.get(GATE_COOKIE)?.value)) {
    return (await withSession(request, pathname)).response;
  }
  const { response, signedIn } = await withSession(request, pathname);
  if (signedIn) return response;
  const url = new URL(GATE_PATH, request.url);
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

/**
 * Rafraîchit la session Supabase (le jeton d'accès dure 1 h) : les Server
 * Components ne peuvent pas poser de cookie, c'est donc fait ici, avant eux.
 */
async function withSession(request: NextRequest, path?: string) {
  const forward = () => {
    const headers = new Headers(request.headers);
    if (path) headers.set("x-d1-path", path);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return { response, signedIn: !!data.user };
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
