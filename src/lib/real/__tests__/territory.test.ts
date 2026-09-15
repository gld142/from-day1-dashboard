import { describe, expect, it } from "vitest";
import {
  countriesFromCities,
  territoryCoefficient,
  zoneDistribution,
  zoneOfCountry,
} from "@/lib/real/territory";

describe("territoire", () => {
  it("classe les pays par zone", () => {
    expect(zoneOfCountry("FR")).toBe("frbech");
    expect(zoneOfCountry("BE")).toBe("frbech");
    expect(zoneOfCountry("DE")).toBe("europe");
    expect(zoneOfCountry("US")).toBe("northAmerica");
    expect(zoneOfCountry("CI")).toBe("africa");
    expect(zoneOfCountry("JP")).toBe("rest");
  });

  it("sans villes, utilise la répartition par défaut du pays de l'artiste", () => {
    const fr = zoneDistribution(null, "FR");
    const tg = zoneDistribution(null, "TG");
    expect(fr.frbech).toBeGreaterThan(tg.frbech);
    expect(tg.africa).toBeGreaterThan(fr.africa);
  });

  it("avec des villes, pondère par les auditeurs et somme à 1", () => {
    const dist = zoneDistribution(
      [
        { city: "Paris", country: "France", listeners: 500_000 },
        { city: "Abidjan", country: "Côte d'Ivoire", listeners: 300_000 },
        { city: "Bruxelles", country: "Belgique", listeners: 200_000 },
      ],
      "FR",
    );
    expect(dist.frbech).toBeCloseTo(0.7, 6);
    expect(dist.africa).toBeCloseTo(0.3, 6);
    expect(Object.values(dist).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
  });

  it("les codes ISO2 des snapshots réels sont reconnus (Kiko : Lomé, Abidjan, Cotonou, Kinshasa, Conakry)", () => {
    const dist = zoneDistribution(
      [
        { city: "Lomé", country: "TG", listeners: 4_613 },
        { city: "Abidjan", country: "CI", listeners: 2_702 },
        { city: "Cotonou", country: "BJ", listeners: 1_283 },
        { city: "Kinshasa", country: "CD", listeners: 1_001 },
        { city: "Conakry", country: "GN", listeners: 751 },
      ],
      "TG",
    );
    expect(dist.africa).toBeCloseTo(1, 6);
    expect(territoryCoefficient(dist)).toBeCloseTo(0.15, 6);
  });

  it("le coefficient d'un artiste à audience africaine est nettement plus bas", () => {
    const fr = territoryCoefficient(zoneDistribution(null, "FR"));
    const tg = territoryCoefficient(zoneDistribution(null, "TG"));
    expect(tg).toBeLessThan(fr * 0.75);
  });

  it("countriesFromCities renvoie des CountryStreams iso3 triés, somme exacte", () => {
    const rows = countriesFromCities(
      [
        { city: "Paris", country: "FR", listeners: 500_000 },
        { city: "Lyon", country: "France", listeners: 100_000 },
        { city: "Abidjan", country: "CI", listeners: 300_000 },
        { city: "Montreal", country: "CA", listeners: 100_000 },
      ],
      1_000_000,
    );
    expect(rows[0]).toMatchObject({ iso3: "FRA", nameFr: "France", nameEn: "France" });
    expect(rows.map((r) => r.iso3)).toEqual(["FRA", "CIV", "CAN"]);
    expect(rows[0].streams).toBeGreaterThan(rows[1].streams);
    expect(rows.reduce((s, r) => s + r.streams, 0)).toBe(1_000_000);
  });
});
