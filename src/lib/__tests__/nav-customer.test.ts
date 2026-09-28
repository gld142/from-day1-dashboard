import { describe, expect, it } from "vitest";
import { isCustomerPath, isStructurePath } from "../nav";

describe("isCustomerPath — pages ouvertes aux clients", () => {
  it("relevé et import : ouverts à tous les rôles", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      expect(isCustomerPath("/mon-releve", role)).toBe(true);
      expect(isCustomerPath("/import", role)).toBe(true);
    }
  });

  it("roster : propriétaire et équipe, JAMAIS l'artiste invité", () => {
    expect(isCustomerPath("/roster", "owner")).toBe(true);
    expect(isCustomerPath("/roster", "member")).toBe(true);
    expect(isCustomerPath("/roster", "artist")).toBe(false);
  });

  it("les pages encore en démo restent fermées, même au propriétaire", () => {
    for (const path of ["/pulse", "/streams", "/revenue", "/valuation", "/contracts", "/rosterx"]) {
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
