import { NextResponse, type NextRequest } from "next/server";
import { syncSubscription } from "@/lib/accounts/provision";
import { stripe } from "@/lib/billing/stripe";
import { userDb } from "@/lib/supabase/server";

/**
 * Retour du portail client Stripe : on relit l'abonnement tout de suite
 * (résiliation, carte…) sans attendre le webhook, pour que /espace soit juste
 * dès le retour. Seulement pour un espace dont la personne est propriétaire.
 */
export async function GET(request: NextRequest) {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/connexion", request.url));
  const { data: me } = await db.from("workspace_members").select("workspace_id").eq("user_id", data.user.id).eq("role", "owner").limit(1).maybeSingle();
  if (me) {
    const { data: ws } = await db.from("workspaces").select("stripe_subscription_id").eq("id", me.workspace_id).single();
    if (ws?.stripe_subscription_id) {
      try {
        await syncSubscription(await stripe().subscriptions.retrieve(ws.stripe_subscription_id));
      } catch (err) {
        console.error("[espace/abonnement/retour]", err);
      }
    }
  }
  return NextResponse.redirect(new URL("/espace", request.url));
}
