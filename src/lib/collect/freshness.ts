/**
 * « Mis à jour le … » d'une source, lu dans le journal collection_runs : le
 * dernier passage réussi (un passage partiel compte : les autres pays sont
 * frais), un échec plus récent s'il y en a un, et « en retard » au-delà de
 * 36 h sans succès (une nuit manquée + marge).
 */
export type SourceRun = {
  id: string;
  source: string;
  status: "running" | "ok" | "partial" | "error";
  started_at: string;
  finished_at: string | null;
  rows: number | null;
  detail: string | null;
};
export type Freshness = { lastSuccess: SourceRun | null; failing: SourceRun | null; stale: boolean };

const STALE_MS = 36 * 3600 * 1000;

export function sourceFreshness(runs: SourceRun[], source: string, now: Date = new Date()): Freshness {
  const mine = runs.filter((r) => r.source === source && r.status !== "running").sort((a, b) => b.started_at.localeCompare(a.started_at));
  const lastSuccess = mine.find((r) => r.status === "ok" || r.status === "partial") ?? null;
  const failing = mine[0]?.status === "error" ? mine[0] : null;
  const stale = !lastSuccess || now.getTime() - new Date(lastSuccess.started_at).getTime() > STALE_MS;
  return { lastSuccess, failing, stale };
}
