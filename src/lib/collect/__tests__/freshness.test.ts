import { describe, expect, it } from "vitest";
import { sourceFreshness, type SourceRun } from "../freshness";

const run = (id: string, started_at: string, status: SourceRun["status"], source = "apple_music"): SourceRun => ({ id, source, status, started_at, finished_at: started_at, rows: 1, detail: null });
const NOW = new Date("2026-09-29T10:00:00Z");

describe("fraîcheur d'une source", () => {
  it("dernier succès (partiel compris) ; échec en cours signalé s'il est postérieur", () => {
    const f = sourceFreshness([run("1", "2026-09-28T04:00:00Z", "ok"), run("2", "2026-09-29T04:00:00Z", "error"), run("3", "2026-09-29T04:00:00Z", "ok", "tiktok_oembed")], "apple_music", NOW);
    expect(f.lastSuccess?.id).toBe("1");
    expect(f.failing?.id).toBe("2");
    expect(f.stale).toBe(false); // 30 h : encore dans la fenêtre d'une nuit manquée
  });
  it("partiel = succès ; en cours ignoré ; plus de 36 h sans succès = en retard", () => {
    const f = sourceFreshness([run("1", "2026-09-27T04:00:00Z", "partial"), run("2", "2026-09-29T09:59:00Z", "running")], "apple_music", NOW);
    expect(f.lastSuccess?.id).toBe("1");
    expect(f.failing).toBeNull();
    expect(f.stale).toBe(true);
  });
  it("jamais relevée", () => {
    expect(sourceFreshness([], "apple_music", NOW)).toEqual({ lastSuccess: null, failing: null, stale: true });
  });
});
