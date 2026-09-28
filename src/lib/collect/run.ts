/**
 * Passage de collecte : chaque source tourne à son tour, son résultat est
 * journalisé (collection_runs), et une source en échec n'empêche pas les
 * suivantes. Les pages lisent ce journal pour dire « mis à jour le … ».
 */
export type CollectResult = { rows: number; detail?: string; partial?: boolean };
export type Collector = { source: string; run: () => Promise<CollectResult> };
export type RunOutcome = { status: "ok" | "partial" | "error"; rows: number | null; detail: string | null };
export type Journal = {
  start(source: string): Promise<number | string>;
  finish(id: number | string, outcome: RunOutcome): Promise<void>;
};
export type RunSummary = ({ source: string; ms: number } & RunOutcome)[];

const DETAIL_MAX = 2000;

export async function runCollectors(collectors: Collector[], journal: Journal, now: () => number = Date.now): Promise<RunSummary> {
  const summary: RunSummary = [];
  for (const c of collectors) {
    const t0 = now();
    const id = await journal.start(c.source);
    let outcome: RunOutcome;
    try {
      const r = await c.run();
      outcome = { status: r.partial ? "partial" : "ok", rows: r.rows, detail: r.detail?.slice(0, DETAIL_MAX) ?? null };
    } catch (e) {
      outcome = { status: "error", rows: null, detail: (e instanceof Error ? e.message : String(e)).slice(0, DETAIL_MAX) };
    }
    await journal.finish(id, outcome);
    summary.push({ source: c.source, ...outcome, ms: now() - t0 });
  }
  return summary;
}
