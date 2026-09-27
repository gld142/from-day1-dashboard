import { NextResponse, type NextRequest } from "next/server";
import { sanitize } from "@/lib/onboarding/lead";
import { upsertLead } from "@/lib/onboarding/lead-store";

/** Crée (sans id) ou complète (avec id) la lead du parcours d'achat. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json" }, { status: 400 });
  }
  const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : undefined;
  const patch = sanitize(body);
  if (!id && !patch.email) return NextResponse.json({ error: "email" }, { status: 400 });
  try {
    const lead = await upsertLead(id, patch);
    return NextResponse.json({ id: lead.id, stage: lead.stage });
  } catch (err) {
    // Le détail reste dans les logs serveur, jamais dans la réponse.
    console.error("[api/leads]", err);
    return NextResponse.json({ error: "store" }, { status: 500 });
  }
}
