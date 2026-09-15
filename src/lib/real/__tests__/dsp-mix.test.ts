import { describe, expect, it } from "vitest";
import { artistMix, deezerWeight } from "@/lib/real/dsp-mix";
import { MARKET_MIX_FR } from "@/lib/real/params";

describe("artistMix", () => {
  it("sans signal Deezer, renvoie le mix de marché", () => {
    expect(artistMix({ deezerFans: null, spotifyMonthlyListeners: 1_000_000 })).toEqual(MARKET_MIX_FR);
  });

  it("Dadju (3,28 M fans / 6,48 M auditeurs) : part Deezer relevée, somme = 1", () => {
    const m = artistMix({ deezerFans: 3_276_021, spotifyMonthlyListeners: 6_481_936 });
    expect(m.deezer).toBeGreaterThan(MARKET_MIX_FR.deezer);
    expect(Object.values(m).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
  });

  it("un ratio très faible est borné à ×0,5", () => {
    const m = artistMix({ deezerFans: 10, spotifyMonthlyListeners: 1_000_000 });
    expect(m.deezer / MARKET_MIX_FR.deezer).toBeGreaterThan(0.45);
  });
});

describe("deezerWeight", () => {
  it("un artiste pro pèse entre 1,5 et 2 fois le stream Deezer moyen", () => {
    const w = deezerWeight({ pro: true });
    expect(w).toBeGreaterThan(1.5);
    expect(w).toBeLessThan(2);
  });
  it("un artiste non pro pèse moins que la moyenne", () => {
    expect(deezerWeight({ pro: false })).toBeLessThan(1);
  });
});
