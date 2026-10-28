import { describe, expect, it } from "vitest";
import { PLACEMENTS } from "@/lib/demo/data";
import {
  activity,
  isRecent,
  parseState,
  seedStage,
  stageToStatus,
  trackPlacements,
  withAdded,
  withStage,
} from "@/lib/userdata/placements-store";

const TODAY = new Date("2026-10-28T12:00:00.000Z");
const EMPTY = parseState(null);

describe("suivi des placements : départ de démo", () => {
  it("sans action de l'équipe, statut et déclaration SACEM sont ceux de data.ts (montants inchangés)", () => {
    const tracked = trackPlacements(EMPTY, PLACEMENTS, TODAY);
    for (const p of PLACEMENTS) {
      const t = tracked.find((x) => x.id === p.id)!;
      expect(t.status).toBe(p.status);
      expect(t.declared).toBe(p.declared);
      expect(t.simulated).toBe(true);
    }
  });

  it("étapes : sortie/déclarée, signée, proposée ou en discussion", () => {
    expect(seedStage({ ...PLACEMENTS[0], status: "released", declared: true })).toBe("declaree");
    expect(seedStage({ ...PLACEMENTS[0], status: "released", declared: false })).toBe("sortie");
    expect(seedStage({ ...PLACEMENTS[0], status: "unreleased" })).toBe("signee");
    expect(stageToStatus("discussion")).toBe("pitched");
  });

  it("l'historique de démo est trié du plus récent au plus ancien et contient des nouveautés", () => {
    const ev = activity(EMPTY, PLACEMENTS, TODAY);
    for (let i = 1; i < ev.length; i++) expect(ev[i - 1].at >= ev[i].at).toBe(true);
    const tracked = trackPlacements(EMPTY, PLACEMENTS, TODAY);
    expect(tracked.some((p) => isRecent(p, TODAY))).toBe(true);
  });
});

describe("suivi des placements : la main de l'équipe", () => {
  const target = PLACEMENTS.find((p) => p.status === "released" && !p.declared)!;

  it("déclarer une œuvre la rend déclarée, datée, signée par le métier, et retire le badge simulé", () => {
    const s = withStage(EMPTY, target.id, "declaree", "Finance", "2026-10-28T09:00:00.000Z");
    const t = trackPlacements(s, PLACEMENTS, TODAY).find((x) => x.id === target.id)!;
    expect(t.declared).toBe(true);
    expect(t.status).toBe("released");
    expect(t.changedBy).toBe("Finance");
    expect(t.simulated).toBe(false);
    expect(activity(s, PLACEMENTS, TODAY)[0]).toMatchObject({ placementId: target.id, stage: "declaree", by: "Finance" });
  });

  it("un placement ajouté à la main apparaît, avec son étape", () => {
    const p = { ...PLACEMENTS[0], id: "pl-u-test", title: "Nouveau", performer: "Quelqu'un", streams: 0 };
    const s = withAdded(EMPTY, p, "discussion", "DA · Inès M.", "2026-10-27T09:00:00.000Z");
    const t = trackPlacements(s, PLACEMENTS, TODAY).find((x) => x.id === "pl-u-test")!;
    expect(t).toMatchObject({ added: true, stage: "discussion", status: "pitched", simulated: false });
    expect(isRecent(t, TODAY)).toBe(true);
  });

  it("un stockage illisible repart de zéro sans lever", () => {
    expect(parseState("{oops")).toEqual(EMPTY);
    expect(parseState(JSON.stringify({ version: 2 }))).toEqual(EMPTY);
  });
});
