import { describe, expect, it } from "vitest";
import { isSiret, sanitize } from "../lead";

describe("isSiret — 14 chiffres et clé de contrôle", () => {
  it("accepte un SIRET dont la clé est juste, espaces tolérés", () => {
    expect(isSiret("12345678900015")).toBe(true);
    expect(isSiret("123 456 789 00015")).toBe(true);
  });
  it("refuse une clé fausse, une mauvaise longueur, des lettres", () => {
    expect(isSiret("12345678900012")).toBe(false);
    expect(isSiret("1234567890001")).toBe(false);
    expect(isSiret("1234567890001A")).toBe(false);
  });
  it("La Poste (SIREN 356000000) : somme des chiffres multiple de 5", () => {
    expect(isSiret("35600000000001")).toBe(true); // 3+5+6+1 = 15
    expect(isSiret("35600000000048")).toBe(false); // 3+5+6+4+8 = 26
  });
});

describe("sanitize — le SIRET n'entre dans la lead que s'il est valide", () => {
  it("valide : gardé sans espaces ; invalide : ignoré", () => {
    expect(sanitize({ siret: "123 456 789 00015" }).siret).toBe("12345678900015");
    expect(sanitize({ siret: "12345678900012" }).siret).toBeUndefined();
  });
});
