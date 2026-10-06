import { describe, expect, it } from "vitest";
import {
  DSP_COEF,
  MARKET_MIX_FR,
  RATE_FR,
  TERRITORY_COEF,
  ZONE_DEFAULTS,
  blendedRate,
} from "@/lib/real/params";

describe("paramètres de l'estimateur", () => {
  it("le taux premium France est celui du SNEP 2025 (553 028 k€ / 122 Md, dossier de presse p. 2 et 6)", () => {
    expect(RATE_FR.premium).toBeCloseTo(553_028e3 / 122e9, 10);
    expect(RATE_FR.free).toBeCloseTo(84_172e3 / 31e9, 10);
    expect(RATE_FR.premium).toBeGreaterThan(0.004);
    expect(RATE_FR.premium).toBeLessThan(0.005);
  });

  it("le taux mixé 80/20 est entre le gratuit et le premium", () => {
    const b = blendedRate({ premium: 0.8, free: 0.2 });
    expect(b).toBeGreaterThan(RATE_FR.free);
    expect(b).toBeLessThan(RATE_FR.premium);
  });

  it("le mix de marché somme à 1", () => {
    const sum = Object.values(MARKET_MIX_FR).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("chaque coefficient DSP est ordonné low ≤ mid ≤ high", () => {
    for (const c of Object.values(DSP_COEF)) {
      expect(c.low).toBeLessThanOrEqual(c.mid);
      expect(c.mid).toBeLessThanOrEqual(c.high);
    }
  });

  it("les zones par défaut somment à 1 pour chaque pays connu", () => {
    for (const dist of Object.values(ZONE_DEFAULTS)) {
      expect(Object.values(dist).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    }
    expect(TERRITORY_COEF.africa).toBeLessThan(TERRITORY_COEF.frbech);
  });
});
