import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ecbFxCollector, eurPerUnit, parseEcbCsv } from "../ecb-fx";

const csv = readFileSync(new URL("./fixtures/ecb-usd-2026-06-08.csv", import.meta.url), "utf8");

describe("taux BCE — vraie réponse (USD, juin–août 2026)", () => {
  it("lit mois et valeur par le nom des colonnes", () => {
    expect(parseEcbCsv(csv, "USD")).toEqual([
      { currency: "USD", month: "2026-06", units_per_eur: 1.1518 },
      { currency: "USD", month: "2026-07", units_per_eur: 1.1417478260869562 },
      { currency: "USD", month: "2026-08", units_per_eur: 1.1593095238095241 },
    ]);
  });
  it("refuse une réponse qui n'est pas le bon flux", () => {
    expect(() => parseEcbCsv("<html>502</html>", "USD")).toThrow(/format/);
    expect(() => parseEcbCsv(csv, "GBP")).toThrow(/devise/);
  });
  it("euros pour 1 unité = 1 ÷ taux publié (1 € = 1,1593 $ → 1 $ = 0,8626 €)", () => {
    expect(eurPerUnit(1.1593095238095241)).toBeCloseTo(0.86258, 5);
  });
});

describe("collecteur BCE", () => {
  it("USD et GBP ; une devise en panne → partiel", async () => {
    const saved: string[] = [];
    const r = await ecbFxCollector({
      fetchCsv: async (cur) => {
        if (cur === "GBP") throw new Error("HTTP 503");
        return csv;
      },
      save: async (rows) => {
        saved.push(...rows.map((x) => `${x.currency}:${x.month}`));
      },
    }).run();
    expect(r).toEqual({ rows: 3, partial: true, detail: "GBP : HTTP 503" });
    expect(saved).toEqual(["USD:2026-06", "USD:2026-07", "USD:2026-08"]);
  });
});
