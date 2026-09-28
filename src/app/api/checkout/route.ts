import { NextResponse, type NextRequest } from "next/server";
import { CHECKOUT_COOKIE, lineItemsFor, stripe } from "@/lib/billing/stripe";
import { appUrl } from "@/lib/app-url";
import { adminDb } from "@/lib/supabase/admin";

/**
 * Démarre le paiement Stripe de la lead `leadId`. Le montant est recalculé ici
 * depuis la lead en base, jamais repris du navigateur.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { leadId?: unknown };
  const leadId = typeof body.leadId === "string" && /^[0-9a-f-]{36}$/.test(body.leadId) ? body.leadId : null;
  if (!leadId) return NextResponse.json({ error: "lead" }, { status: 400 });

  try {
    const { data: lead } = await adminDb().from("leads").select("id, email, artist_count").eq("id", leadId).maybeSingle();
    if (!lead) return NextResponse.json({ error: "lead" }, { status: 404 });
    const plan = await lineItemsFor(lead.artist_count ?? 1);
    if (!plan) return NextResponse.json({ error: "devis" }, { status: 400 });

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: plan.items,
      customer_email: lead.email,
      client_reference_id: lead.id,
      metadata: { lead_id: lead.id },
      subscription_data: { metadata: { lead_id: lead.id } },
      locale: "fr",
      success_url: `${appUrl("/inscription/succes")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: appUrl("/inscription?paiement=annule"),
    });
    await adminDb().from("leads").update({ stage: "checkout" }).eq("id", lead.id);

    const res = NextResponse.json({ url: session.url });
    // Lie ce paiement à ce navigateur : seule la personne qui a payé ici sera connectée au retour.
    res.cookies.set(CHECKOUT_COOKIE, session.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
    return res;
  } catch (err) {
    console.error("[api/checkout]", err);
    return NextResponse.json({ error: "stripe" }, { status: 502 });
  }
}
