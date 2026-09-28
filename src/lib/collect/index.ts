/**
 * Branchement des collecteurs sur Supabase (clé secrète, serveur seulement) :
 * journal collection_runs, enregistrement des classements. Appelé par
 * /api/cron/collect (Vercel Cron, chaque nuit) ou à la main (scripts/collect-now.sh).
 */
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/supabase/admin";
import { appleMusicCollector, type ChartEntry } from "./apple-music";
import { runCollectors, type Collector, type Journal } from "./run";
import { supabaseTikTokStore, tiktokRefreshCollector } from "./tiktok-refresh";

export function supabaseJournal(db: SupabaseClient): Journal {
  return {
    // Début et fin datés par la MÊME horloge (celle du serveur) : mesuré le 28/09, horloge
    // de la base au début et du serveur à la fin donnaient une durée négative (−44 ms).
    start: async (source) => {
      const { data, error } = await db.from("collection_runs").insert({ source, started_at: new Date().toISOString() }).select("id").single();
      if (error) throw new Error(`journal : ${error.message}`);
      return data.id as number;
    },
    finish: async (id, outcome) => {
      const { error } = await db.from("collection_runs").update({ ...outcome, finished_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(`journal : ${error.message}`);
    },
  };
}

/** Remplace le classement d'un pays pour ce jour (un second passage le même jour écrase le premier). */
export async function saveChart(db: SupabaseClient, country: string, chartDate: string, rows: ChartEntry[]) {
  if (!rows.length) throw new Error("classement vide");
  const collected_at = new Date().toISOString();
  const { error } = await db
    .from("chart_entries")
    .upsert(rows.map((r) => ({ ...r, collected_at })), { onConflict: "source,chart,country,chart_date,position" });
  if (error) throw new Error(`Supabase : ${error.message}`);
  const { error: staleError } = await db
    .from("chart_entries")
    .delete()
    .match({ source: rows[0].source, chart: rows[0].chart, country, chart_date: chartDate })
    .not("position", "in", `(${rows.map((r) => r.position).join(",")})`);
  if (staleError) throw new Error(`Supabase : ${staleError.message}`);
}

export function allCollectors(db: SupabaseClient): Collector[] {
  return [appleMusicCollector({ save: (country, date, rows) => saveChart(db, country, date, rows) }), tiktokRefreshCollector(supabaseTikTokStore(db))];
}

export async function collectNow() {
  const db = adminDb();
  return runCollectors(allCollectors(db), supabaseJournal(db));
}

/** En-tête Authorization envoyé par Vercel Cron : « Bearer <CRON_SECRET> », comparé en temps constant. */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
