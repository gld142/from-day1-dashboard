import { NextResponse, type NextRequest } from "next/server";
import { collectNow, isCronAuthorized } from "@/lib/collect";

/**
 * Collecte de la nuit (Vercel Cron, voir vercel.json) : classements Apple Music,
 * rafraîchissement des vidéos TikTok collées. Protégée par CRON_SECRET, que
 * Vercel envoie dans l'en-tête Authorization. Le détail va dans collection_runs.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "collecte non configurée (CRON_SECRET)" }, { status: 503 });
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const summary = await collectNow();
  const allFailed = summary.every((s) => s.status === "error");
  return NextResponse.json({ ok: !allFailed, summary }, { status: allFailed ? 502 : 200 });
}
