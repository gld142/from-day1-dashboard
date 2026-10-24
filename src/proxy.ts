import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { demoEnabled } from "@/lib/demo-mode";
import { GATE_COOKIE, GATE_PATH, isValidToken } from "@/lib/gate";
/* Module léger, jamais nav.ts (icônes lucide-react) : ce bundle tourne avant chaque requête. */
import { UNMATCHED_PATH, isRouteAllowedForTenant } from "@/lib/internal-routes";
import { TENANT } from "@/lib/tenant";

/**
 * Parcours d'achat et API qui le servent : publics, pour des visiteurs pas encore clients.
 * /api/cron : la collecte de la nuit, protégée par CRON_SECRET dans la route elle-même.
 */
const PUBLIC = /^\/(acces|inscription|api\/leads|api\/checkout|api\/stripe|api\/cron)(\/|$)/;
/** Espace client : protégé par la connexion Supabase (vérifiée dans chaque page), pas par la porte. */
const ACCOUNT = /^\/(espace|connexion|auth|invitation|api\/imports|api\/fx)(\/|$)/;
/** Pages qui n'existent que pour la démo : la porte à mot de passe et l'écran d'accueil co-brandé. */
const DEMO_ONLY = /^\/(acces|welcome)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Page que la maison n'ouvre pas (pages internes From Day 1 hors maison day1) : 404 RÉEL, avant la
  // porte et la session — même sans cookie, rien ne dit qu'elle existe. `notFound()` dans la page
  // répondait 200 (réponse en flux sous le loading.tsx de (dashboard) : doc Next 16, loading.md
  // « Status Codes », qui recommande ce contrôle dans le proxy). Réécriture vers une route
  // introuvable : Next y rend app/not-found.tsx, avec son interface, en 404.
  if (!isRouteAllowedForTenant(pathname, TENANT)) return NextResponse.rewrite(new URL(UNMATCHED_PATH, request.url));
  // Démo éteinte (défaut du produit) : ses pages n'existent pas, et on ne s'y
  // fait jamais renvoyer — la connexion client à la place.
  if (!demoEnabled() && DEMO_ONLY.test(pathname)) return NextResponse.redirect(new URL("/connexion", request.url));
  if (PUBLIC.test(pathname)) return NextResponse.next();
  if (ACCOUNT.test(pathname)) return (await withSession(request)).response;

  // Dashboard : la démo derrière le mot de passe, OU un client connecté (le layout
  // choisit le mode et vérifie l'abonnement). Le chemin lui est transmis.
  if (demoEnabled() && (await isValidToken(request.cookies.get(GATE_COOKIE)?.value))) {
    return (await withSession(request, pathname)).response;
  }
  const { response, signedIn } = await withSession(request, pathname);
  if (signedIn) return response;
  if (!demoEnabled()) return NextResponse.redirect(new URL("/connexion", request.url));
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
    if (path) {
      headers.set("x-d1-path", path);
      // La chaîne de requête brute (« ?perimetre=label »), pour que le layout ne charge que ce que l'URL demande.
      headers.set("x-d1-search", request.nextUrl.search);
    }
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
