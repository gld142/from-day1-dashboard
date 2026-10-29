import { describe, expect, it } from "vitest";
import { addMonthsUTC } from "@/lib/demo/seed";

describe("addMonthsUTC : jamais de débordement de fin de mois", () => {
  it("le 29 octobre moins 8 mois tombe en février (28), pas en mars", () => {
    expect(addMonthsUTC(new Date("2026-10-29T00:00:00Z"), -8).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("le 31 mars plus 1 mois donne le 30 avril ; une année bissextile garde le 29 février", () => {
    expect(addMonthsUTC(new Date("2026-03-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(addMonthsUTC(new Date("2028-03-29T00:00:00Z"), -1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("24 mois d'affilée depuis un 29 : 24 mois distincts, février compris", () => {
    const months = Array.from({ length: 24 }, (_, i) => addMonthsUTC(new Date("2026-10-29T00:00:00Z"), -i).toISOString().slice(0, 7));
    expect(new Set(months).size).toBe(24);
    expect(months).toContain("2026-02");
    expect(months).toContain("2025-02");
  });
});
