import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { provisionFromCheckout, syncSubscription } from "@/lib/accounts/provision";

/**
 * Notifications Stripe (signées). Filet de sécurité de la page de retour : si
 * la personne ferme l'onglet après avoir payé, l'espace est créé quand même.
 * À déclarer dans Stripe au déploiement, avec STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await provisionFromCheckout(event.data.object.id);
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object);
    }
  } catch (err) {
    console.error("[stripe/webhook]", event.type, err);
    return NextResponse.json({ error: "traitement" }, { status: 500 }); // Stripe réessaiera
  }
  return NextResponse.json({ received: true });
}
