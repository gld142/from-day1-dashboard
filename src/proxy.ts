import { NextResponse, type NextRequest } from "next/server";

/**
 * Porte à mot de passe DÉSACTIVÉE le 02/10/2026 à la demande de Gaël : la démo s'ouvre
 * sans code. L'ancienne page /acces renvoie vers l'accueil. Pour la remettre : revenir
 * au commit c276112 (étiquette demo-2026-09-25).
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/acces"],
};
