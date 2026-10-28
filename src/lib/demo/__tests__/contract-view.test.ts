import { describe, expect, it } from "vitest";
import type { Contract } from "@/lib/demo/types";
import {
  activeInYear,
  contractYears,
  filterRows,
  horizonOf,
  nextDueOf,
  remainingOf,
  sortRows,
  toRows,
} from "@/lib/demo/contract-view";

const TODAY = "2026-10-28";

function contract(over: Partial<Contract>): Contract {
  return {
    id: "c",
    artistId: "a",
    type: "licence",
    counterparty: "Label",
    startDate: "2024-01-01",
    endDate: "2027-01-01",
    royaltyRate: 20,
    advance: 0,
    recoupedPct: 0,
    territory: "World",
    exclusive: true,
    alerts: [],
    ...over,
  };
}

const NAMES: Record<string, string> = { a: "Aurèle", b: "Élodie", c: "zed" };
const rowsOf = (cs: Contract[]) =>
  toRows(cs, TODAY, (id) => NAMES[id] ?? id, (c) => (c.type === "édition" ? "Édition" : c.type));

describe("contrats : reste, prochaine date, années", () => {
  it("le reste à recouper se compte contrat par contrat, jamais négatif", () => {
    expect(remainingOf(contract({ advance: 100_000, recoupedPct: 71 }))).toBeCloseTo(29_000);
    expect(remainingOf(contract({ advance: 100_000, recoupedPct: 120 }))).toBe(0);
  });

  it("la prochaine date : une alerte à venir avant la fin du contrat ; rien pour un contrat terminé", () => {
    const c = contract({ endDate: "2027-03-01", alerts: [{ kind: "option", severity: "warning", message: { fr: "", en: "" }, dueDate: "2026-11-30" }] });
    expect(nextDueOf(c, TODAY)).toBe("2026-11-30");
    expect(nextDueOf(contract({ endDate: "2026-01-01" }), TODAY)).toBeNull();
    // une alerte déjà passée ne compte pas
    const passee = contract({ endDate: "2027-03-01", alerts: [{ kind: "option", severity: "info", message: { fr: "", en: "" }, dueDate: "2026-01-01" }] });
    expect(nextDueOf(passee, TODAY)).toBe("2027-03-01");
  });

  it("années couvertes et « en cours en {année} »", () => {
    const cs = [contract({ startDate: "2023-03-01", endDate: "2025-06-01" }), contract({ startDate: "2024-01-01", endDate: "2027-02-01" })];
    expect(contractYears(cs)).toEqual([2023, 2024, 2025, 2026, 2027]);
    expect(activeInYear(cs[0], 2026)).toBe(false);
    expect(activeInYear(cs[1], 2026)).toBe(true);
  });
});

describe("contrats : recherche et tri", () => {
  const cs = [
    contract({ id: "1", artistId: "c", counterparty: "Believe Digital", advance: 50_000, recoupedPct: 90, endDate: "2026-12-31" }),
    contract({ id: "2", artistId: "a", type: "édition", counterparty: "Universal Music Publishing", advance: 200_000, recoupedPct: 40, endDate: "2028-01-01" }),
    contract({ id: "3", artistId: "b", counterparty: "Label", advance: 0, endDate: "2025-01-01", startDate: "2022-01-01" }),
  ];

  it("la recherche ignore accents et casse, sur l'artiste, la contrepartie, le type", () => {
    const rows = rowsOf(cs);
    expect(filterRows(rows, "elodie", null).map((r) => r.contract.id)).toEqual(["3"]);
    expect(filterRows(rows, "EDITION", null).map((r) => r.contract.id)).toEqual(["2"]);
    expect(filterRows(rows, "believe", null).map((r) => r.contract.id)).toEqual(["1"]);
    expect(filterRows(rows, "", 2026).map((r) => r.contract.id).sort()).toEqual(["1", "2"]);
  });

  it("A → Z suit l'ordre alphabétique français (accents compris)", () => {
    expect(sortRows(rowsOf(cs), "artist", "asc").map((r) => r.artistName)).toEqual(["Aurèle", "Élodie", "zed"]);
  });

  it("reste à recouper : le plus gros en tête au premier clic", () => {
    expect(sortRows(rowsOf(cs), "remaining", "desc").map((r) => r.contract.id)).toEqual(["2", "1", "3"]);
  });

  it("prochaine échéance : un contrat terminé reste en bas, dans les deux sens", () => {
    expect(sortRows(rowsOf(cs), "next", "asc").map((r) => r.contract.id)).toEqual(["1", "2", "3"]);
    expect(sortRows(rowsOf(cs), "next", "desc").map((r) => r.contract.id)).toEqual(["2", "1", "3"]);
  });
});

describe("ce qui arrive : horizon d'une échéance", () => {
  const a = (dueDate?: string) => ({ kind: "option" as const, severity: "info" as const, message: { fr: "", en: "" }, dueDate });
  it("sans date, dépassée, 30 jours, 3 mois, plus tard", () => {
    expect(horizonOf(a(), TODAY)).toBe("undated");
    expect(horizonOf(a("2026-10-01"), TODAY)).toBe("overdue");
    expect(horizonOf(a("2026-11-27"), TODAY)).toBe("soon");
    expect(horizonOf(a("2027-01-20"), TODAY)).toBe("quarter");
    expect(horizonOf(a("2027-03-31"), TODAY)).toBe("later");
  });
});
