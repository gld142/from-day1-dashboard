import { describe, expect, it } from "vitest";
import { coverageNote, labelLine, missingDetailLine } from "../shared";
import type { LabelStatement } from "@/lib/userdata/merge";
import type { MonthPoint } from "@/lib/userdata/statement-insights";

const month = (m: string) => m;
const point = (m: string, partial: boolean, missing = false): MonthPoint => ({ month: m, missing, partial, revenue: 1, streams: 1, per1000: null, streamsByDsp: {}, revenueByDsp: null });
const label = (over: Partial<LabelStatement> = {}): LabelStatement => ({ data: null, artists: 3, withStatement: 2, coverage: { "2026-04": 1, "2026-05": 1, "2026-06": 2 }, spans: [{ id: "a", name: "Dadju", from: "2026-04", to: "2026-06" }, { id: "b", name: "Kiko", from: "2026-06", to: "2026-06" }], missingDetail: [], ...over });

describe("labelLine", () => {
  it("compte artistes et relevés, avec la période", () => {
    const d = { months: ["2026-06", "2026-04"], scope: { kind: "label", artists: 3, withStatement: 2, coverage: {} } } as never;
    expect(labelLine(d, month)).toBe("Tout le label · 3 artistes, 2 relevés · 2026-04 → 2026-06");
  });
});
describe("coverageNote", () => {
  it("null sans mois partiel", () => {
    expect(coverageNote([point("2026-06", false)], label(), month)).toBeNull();
  });
  it("groupe les mois par couverture et explique par les périodes des relevés", () => {
    expect(coverageNote([point("2026-04", true), point("2026-05", true), point("2026-06", false)], label(), month)).toBe(
      "2026-04, 2026-05 : 1 artiste sur 2 (le relevé de Kiko couvre 2026-06 → 2026-06). Les mois atténués ne sont pas comparables aux autres.",
    );
  });
  it("ignore les mois absents du relevé", () => {
    expect(coverageNote([point("2026-05", true, true)], label(), month)).toBeNull();
  });
});
describe("missingDetailLine", () => {
  it("null quand tous ont le détail ; sinon nomme les artistes et accorde le pluriel", () => {
    expect(missingDetailLine(label(), "titles")).toBeNull();
    expect(missingDetailLine(label({ missingDetail: [{ id: "b", name: "Kiko", what: ["titles"] }] }), "titles")).toBe("Kiko : relevé importé avant le détail par titre. Réimporte son relevé pour le voir ici.");
    expect(missingDetailLine(label({ missingDetail: [{ id: "a", name: "Dadju", what: ["detail"] }, { id: "b", name: "Kiko", what: ["detail"] }] }), "detail")).toBe("Dadju, Kiko : relevé importé avant le détail mois par mois. Réimporte leurs relevés pour le voir ici.");
  });
});
