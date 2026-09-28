import { describe, expect, it } from "vitest";
import { isCustomerPath, isStructurePath, needsStatement } from "../nav";

describe("isCustomerPath — pages ouvertes aux clients", () => {
  it("relevé, revenus, streams et import : ouverts à tous les rôles", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      for (const path of ["/mon-releve", "/revenue", "/streams", "/audit", "/contracts", "/splits", "/rights", "/finances", "/catalog", "/calculator", "/tour", "/placements", "/sync", "/import"]) expect(isCustomerPath(path, role)).toBe(true);
    }
  });

  it("roster : propriétaire et équipe, JAMAIS l'artiste invité", () => {
    expect(isCustomerPath("/roster", "owner")).toBe(true);
    expect(isCustomerPath("/roster", "member")).toBe(true);
    expect(isCustomerPath("/roster", "artist")).toBe(false);
  });

  it("marché & signaux (réels depuis le 29/09) : ouverts à tous les rôles ; A&R pour la structure seulement", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      for (const path of ["/pulse", "/market", "/audience", "/algo-position", "/discovery", "/day1-index"]) expect(isCustomerPath(path, role)).toBe(true);
    }
    expect(isCustomerPath("/ar-watch", "owner")).toBe(true);
    expect(isCustomerPath("/ar-watch", "member")).toBe(true);
    expect(isCustomerPath("/ar-watch", "artist")).toBe(false);
  });

  it("les pages encore en démo restent fermées, même au propriétaire", () => {
    for (const path of ["/valuation", "/urssaf", "/copilot", "/fans", "/rosterx"]) {
      expect(isCustomerPath(path, "owner")).toBe(false);
    }
  });

  it("vue structure = /roster et ses sous-pages seulement", () => {
    expect(isStructurePath("/roster")).toBe(true);
    expect(isStructurePath("/roster/detail")).toBe(true);
    expect(isStructurePath("/rosterx")).toBe(false);
    expect(isStructurePath("/mon-releve")).toBe(false);
  });
});

describe("needsStatement — renvoi vers /import quand l'artiste n'a pas de relevé", () => {
  it("pages qui lisent le relevé : oui ; import, roster, contrats : non", () => {
    for (const path of ["/mon-releve", "/revenue", "/streams", "/audit"]) expect(needsStatement(path)).toBe(true);
    for (const path of ["/import", "/roster", "/contracts", "/splits", "/rights", "/finances", "/catalog", "/tour", "/placements", "/sync"]) expect(needsStatement(path)).toBe(false);
    for (const path of ["/pulse", "/market", "/audience", "/algo-position", "/discovery", "/day1-index", "/ar-watch"]) expect(needsStatement(path)).toBe(false);
  });
});
