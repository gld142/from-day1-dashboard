import { describe, expect, it } from "vitest";
import { isCustomerPath, isStructurePath, needsStatement } from "../nav";

describe("isCustomerPath — pages ouvertes aux clients", () => {
  it("relevé, revenus, streams et import : ouverts à tous les rôles", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      for (const path of ["/mon-releve", "/revenue", "/streams", "/audit", "/contracts", "/import"]) expect(isCustomerPath(path, role)).toBe(true);
    }
  });

  it("roster : propriétaire et équipe, JAMAIS l'artiste invité", () => {
    expect(isCustomerPath("/roster", "owner")).toBe(true);
    expect(isCustomerPath("/roster", "member")).toBe(true);
    expect(isCustomerPath("/roster", "artist")).toBe(false);
  });

  it("les pages encore en démo restent fermées, même au propriétaire", () => {
    for (const path of ["/pulse", "/audience", "/valuation", "/splits", "/rights", "/rosterx"]) {
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
    for (const path of ["/import", "/roster", "/contracts"]) expect(needsStatement(path)).toBe(false);
  });
});
