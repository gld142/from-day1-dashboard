import { describe, expect, it } from "vitest";
import { rosterHue } from "../format";

describe("rosterHue — la teinte d'un artiste d'un espace client", () => {
  it("part du violet de la marque, puis avance à l'angle d'or", () => {
    expect(rosterHue(0)).toBe(265);
    expect(rosterHue(1)).toBe(43); // (265 + 137,5) mod 360 arrondi
  });
  it("reste dans [0, 360[ et distingue les premiers artistes", () => {
    const hues = Array.from({ length: 12 }, (_, i) => rosterHue(i));
    for (const h of hues) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
    expect(new Set(hues).size).toBe(12);
  });
  it("un rang introuvable (-1) retombe sur la teinte du premier", () => {
    expect(rosterHue(-1)).toBe(rosterHue(0));
  });
});
