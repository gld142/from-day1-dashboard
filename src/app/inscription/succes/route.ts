import { NextResponse, type NextRequest } from "next/server";
import { claimOwnerAutologin, provisionFromCheckout } from "@/lib/accounts/provision";
import { signInOnResponse } from "@/lib/accounts/users";
import { CHECKOUT_COOKIE } from "@/lib/billing/stripe";

/**
 * Retour de Stripe après paiement. Le paiement est revérifié auprès de Stripe
 * (l'adresse seule ne prouve rien), l'espace est créé, puis la personne est
 * connectée — seulement si c'est bien ce navigateur qui a payé, que le compte
 * vient d'être créé par ce paiement, et une seule fois. Sinon : page de connexion.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const home = (path: string) => new URL(path, request.url);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return NextResponse.redirect(home("/inscription"));

  try {
    const workspace = await provisionFromCheckout(sessionId);
    const samebrowser = request.cookies.get(CHECKOUT_COOKIE)?.value === sessionId;
    if (samebrowser && (await claimOwnerAutologin(workspace.id))) {
      const res = NextResponse.redirect(home("/espace?bienvenue=1"));
      await signInOnResponse(workspace.ownerEmail, request, res);
      res.cookies.delete(CHECKOUT_COOKIE);
      return res;
    }
    // Pas d'email dans l'adresse : quelqu'un qui aurait ce lien n'a pas à le lire.
    const res = NextResponse.redirect(home("/connexion?paye=1"));
    res.cookies.delete(CHECKOUT_COOKIE);
    return res;
  } catch (err) {
    console.error("[inscription/succes]", err);
    return NextResponse.redirect(home("/inscription?paiement=erreur"));
  }
}
