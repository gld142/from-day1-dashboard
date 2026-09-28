import { describe, expect, it } from "vitest";
import { FetchError, fetchWithRetry } from "../fetch";
import { runCollectors, type Journal } from "../run";

const noSleep = async () => {};
const reply = (status: number, body = "{}") => new Response(body, { status });

describe("fetchWithRetry", () => {
  it("réessaie un 502 et rend la réponse du 2e essai (flux Apple mesuré instable le 28/09)", async () => {
    const seen: number[] = [];
    const answers = [reply(502), reply(200, '{"ok":1}')];
    const res = await fetchWithRetry("https://x.test/a", { fetchImpl: async () => { seen.push(1); return answers.shift()!; }, sleep: noSleep });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: 1 });
    expect(seen).toHaveLength(2);
  });

  it("abandonne après N essais en citant le dernier statut", async () => {
    let calls = 0;
    const p = fetchWithRetry("https://x.test/b", { tries: 3, fetchImpl: async () => { calls++; return reply(504); }, sleep: noSleep });
    await expect(p).rejects.toThrow(/échec après 3 essais \(HTTP 504\)/);
    expect(calls).toBe(3);
  });

  it("ne réessaie pas une erreur 4xx (vidéo TikTok introuvable = 400) et garde le statut", async () => {
    let calls = 0;
    const err = await fetchWithRetry("https://x.test/c", { fetchImpl: async () => { calls++; return reply(400); }, sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.status).toBe(400);
    expect(calls).toBe(1);
  });

  it("réessaie un 429 (trop de requêtes)", async () => {
    const answers = [reply(429), reply(200)];
    const res = await fetchWithRetry("https://x.test/d", { fetchImpl: async () => answers.shift()!, sleep: noSleep });
    expect(res.status).toBe(200);
  });

  it("réessaie un délai dépassé", async () => {
    let calls = 0;
    const res = await fetchWithRetry("https://x.test/e", {
      fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new DOMException("The operation timed out.", "TimeoutError");
        return reply(200);
      },
      sleep: noSleep,
    });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("attend de plus en plus longtemps entre les essais", async () => {
    const waits: number[] = [];
    await fetchWithRetry("https://x.test/f", { tries: 3, backoffMs: 100, fetchImpl: async () => reply(502), sleep: async (ms) => { waits.push(ms); } }).catch(() => {});
    expect(waits).toEqual([100, 200]);
  });
});

describe("runCollectors", () => {
  function memoryJournal() {
    const rows: { id: number; source: string; status?: string; rows?: number | null; detail?: string | null }[] = [];
    const journal: Journal = {
      start: async (source) => {
        rows.push({ id: rows.length + 1, source });
        return rows.length;
      },
      finish: async (id, outcome) => {
        Object.assign(rows[Number(id) - 1], outcome);
      },
    };
    return { rows, journal };
  }

  it("une source en échec n'empêche pas les autres, et chaque passage est journalisé", async () => {
    const { rows, journal } = memoryJournal();
    const summary = await runCollectors(
      [
        { source: "a", run: async () => { throw new Error("HTTP 504"); } },
        { source: "b", run: async () => ({ rows: 42 }) },
        { source: "c", run: async () => ({ rows: 7, partial: true, detail: "ma : HTTP 502" }) },
      ],
      journal,
    );
    expect(rows).toEqual([
      { id: 1, source: "a", status: "error", rows: null, detail: "HTTP 504" },
      { id: 2, source: "b", status: "ok", rows: 42, detail: null },
      { id: 3, source: "c", status: "partial", rows: 7, detail: "ma : HTTP 502" },
    ]);
    expect(summary.map((s) => [s.source, s.status])).toEqual([["a", "error"], ["b", "ok"], ["c", "partial"]]);
  });

  it("tronque un message d'erreur trop long (la colonne détail fait 2000 caractères)", async () => {
    const { rows, journal } = memoryJournal();
    await runCollectors([{ source: "a", run: async () => { throw new Error("x".repeat(5000)); } }], journal);
    expect(rows[0].detail).toHaveLength(2000);
  });
});
