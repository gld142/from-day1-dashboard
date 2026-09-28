import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";

/**
 * Taux BCE mensuels d'une devise (relevés chaque nuit dans fx_monthly), pour que la
 * page d'import convertisse un relevé au taux du mois de chaque vente. Compte connecté.
 * Réponse : { currency, eurPerUnit: { "AAAA-MM": euros pour 1 unité } }.
 */
export async function GET(request: NextRequest) {
  const currency = request.nextUrl.searchParams.get("currency");
  if (currency !== "USD" && currency !== "GBP") return NextResponse.json({ error: "devise" }, { status: 400 });
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "session" }, { status: 401 });
  const { data, error } = await db.from("fx_monthly").select("month, units_per_eur").eq("currency", currency).order("month");
  if (error) return NextResponse.json({ error: "lecture" }, { status: 500 });
  const eurPerUnit = Object.fromEntries((data ?? []).map((r) => [r.month as string, 1 / Number(r.units_per_eur)]));
  return NextResponse.json({ currency, eurPerUnit });
}
