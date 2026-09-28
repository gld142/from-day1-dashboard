import { describe, expect, it } from "vitest";
import { parseStatement } from "../parse-csv";
import { buildUserData, DETAIL_TITLES } from "../store";
import { validateUserData } from "../validate";

const CSV = `Reporting Date,Sale Month,Store,Artist,Title,ISRC,UPC,Quantity,Team Percentage,Song/Album,Country of Sale,Songwriter Royalties Withheld,Earnings (USD)
2026-05-15,2026-03,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,15230,100,Song,FR,1.00,45.69
2026-05-15,2026-03,Spotify,Mon Projet,Deuxième Titre,FR1234567891,123456789012,8450,100,Song,BE,0,25.35
2026-06-15,2026-04,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,18900,100,Song,FR,0,56.70`;

describe("détail enregistré (29/09/2026)", () => {
  const d = buildUserData(parseStatement(CSV), { artistName: "Mon Projet", eurRate: 0.9 });

  it("revenus du détail convertis en euros au taux de l'import", () => {
    expect(d.trackMonthRevenue?.["Premier Titre"]).toEqual({ "2026-03": 41.12, "2026-04": 51.03 });
    expect(d.countryMonthRevenue?.BE).toEqual({ "2026-03": 22.82 });
    expect(d.saleReportRevenue).toEqual({ "2026-03>2026-05": 63.94, "2026-04>2026-06": 51.03 });
    expect(d.withheldEur).toBe(0.9);
    expect(d.artistRevenue).toEqual({ "Mon Projet": 114.97 }); // (45,69 + 25,35 + 56,70) × 0,9
  });

  it("streams, ISRC gardés tels quels", () => {
    expect(d.trackMonthStreams?.["Premier Titre"]).toEqual({ "2026-03": 15230, "2026-04": 18900 });
    expect(d.trackIsrc).toEqual({ "Premier Titre": "FR1234567890", "Deuxième Titre": "FR1234567891" });
  });

  it("la validation serveur garde le détail…", () => {
    const v = validateUserData(JSON.parse(JSON.stringify(d)));
    expect(v?.trackMonthRevenue).toEqual(d.trackMonthRevenue);
    expect(v?.saleReportRevenue).toEqual(d.saleReportRevenue);
    expect(v?.trackIsrc).toEqual(d.trackIsrc);
    expect(v?.withheldEur).toBe(0.9);
  });

  it("…et refuse un détail mal formé", () => {
    expect(validateUserData({ ...d, trackIsrc: { T: "pas-un-isrc" } })).toBeNull();
    expect(validateUserData({ ...d, saleReportRevenue: { "2026-03": 1 } })).toBeNull();
    expect(validateUserData({ ...d, countryMonthStreams: { FRA: { "2026-03": 1 } } })).toBeNull();
    expect(validateUserData({ ...d, trackMonthStreams: { T: { "2026-3": 1 } } })).toBeNull();
  });

  it("un relevé enregistré avant le 29/09 (sans détail) reste valide", () => {
    const { trackMonthStreams: _a, trackMonthRevenue: _b, countryMonthStreams: _c, countryMonthRevenue: _d, trackIsrc: _e, saleReportRevenue: _f, withheldEur: _g, artistRevenue: _h, ...old } = d;
    const v = validateUserData(old);
    expect(v).not.toBeNull();
    expect(v?.trackMonthStreams).toBeUndefined();
  });

  it(`détail mensuel plafonné aux ${DETAIL_TITLES} titres qui rapportent le plus (taille en base)`, () => {
    const rows = Array.from({ length: DETAIL_TITLES + 20 }, (_, i) => `2026-05-15,2026-03,Spotify,A,T${i},,,${100 + i},100,Song,FR,0,${(1 + i / 100).toFixed(2)}`);
    const big = buildUserData(parseStatement([CSV.split("\n")[0], ...rows].join("\n")), { artistName: "A", eurRate: 1, currency: "USD" });
    const kept = Object.keys(big.trackMonthRevenue ?? {});
    expect(kept).toHaveLength(DETAIL_TITLES);
    expect(kept).not.toContain("T0"); // le moins rémunéré sort du détail…
    expect(big.trackRevenue?.T0).toBe(1); // …mais reste dans les totaux par titre
    expect(big.trackMonthStreams?.T0).toBeUndefined();
  });
});
