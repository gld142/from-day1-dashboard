import { describe, expect, it } from "vitest";
import { parseStatement } from "../parse-csv";
import { buildUserData } from "../store";
import { validateUserData } from "../validate";

const DISTROKID_CSV = `Reporting Date,Sale Month,Store,Artist,Title,ISRC,UPC,Quantity,Team Percentage,Song/Album,Country of Sale,Songwriter Royalties Withheld,Earnings (USD)
2026-05-15,2026-03,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,15230,100,Song,FR,0,45.69
2026-05-15,2026-04,Deezer,Mon Projet,Deuxième Titre,FR1234567891,123456789012,2100,100,Song,FR,0,7.14`;
const TUNECORE_CSV = `Sales Period;Store Name;Artist;Release Type;Song Title;Units Sold;Total Earned
2026-01;Spotify;Autre Artiste;Single;Titre A;12000;36,50
2026-02;Spotify;Autre Artiste;Single;Titre B;9800;29,10`;

const build = (csv: string, currency?: "EUR" | "USD" | "GBP") =>
  buildUserData(parseStatement(csv), { artistName: "Mon Projet", eurRate: 0.92, currency });

describe("buildUserData — la devise n'est jamais devinée", () => {
  it("relevé sans devise (TuneCore) et rien de choisi : refusé", () => {
    expect(() => build(TUNECORE_CSV)).toThrow("CURRENCY_REQUIRED");
  });
  it("devise choisie EUR : taux 1, montants inchangés", () => {
    const data = build(TUNECORE_CSV, "EUR");
    expect(data).toMatchObject({ sourceCurrency: "EUR", eurRate: 1 });
    expect(data.revenueByMonth).toEqual({ "2026-01": 36.5, "2026-02": 29.1 });
  });
  it("devise choisie USD : le taux saisi s'applique", () => {
    const data = build(TUNECORE_CSV, "USD");
    expect(data).toMatchObject({ sourceCurrency: "USD", eurRate: 0.92 });
    expect(data.revenueByMonth["2026-01"]).toBeCloseTo(36.5 * 0.92, 2);
  });
  it("devise lue dans le fichier : prime sur un choix", () => {
    expect(build(DISTROKID_CSV, "EUR")).toMatchObject({ sourceCurrency: "USD", eurRate: 0.92 });
  });
});

describe("validateUserData", () => {
  it("accepte tel quel un relevé construit par l'import (DistroKid)", () => {
    const data = build(DISTROKID_CSV);
    expect(validateUserData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it("accepte un relevé TuneCore dont la devise a été choisie", () => {
    const data = build(TUNECORE_CSV, "EUR");
    expect(validateUserData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it("refuse une devise inconnue, et un relevé en euros converti", () => {
    const ok = build(TUNECORE_CSV, "EUR");
    expect(validateUserData({ ...ok, sourceCurrency: "unknown" })).toBeNull();
    expect(validateUserData({ ...ok, eurRate: 0.92 })).toBeNull();
    expect(validateUserData({ ...build(TUNECORE_CSV, "USD"), eurRate: 0 })).toBeNull();
  });
  it("garde les revenus par plateforme, titre et pays, convertis en euros", () => {
    const data = build(DISTROKID_CSV);
    expect(data.revenueByMonthDsp?.["2026-03"]?.spotify).toBeCloseTo(45.69 * 0.92, 2);
    expect(data.trackRevenue?.["Premier Titre"]).toBeCloseTo(45.69 * 0.92, 2);
    expect(data.countryRevenue?.FR).toBeCloseTo((45.69 + 7.14) * 0.92, 2);
    expect(validateUserData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it("accepte un relevé enregistré avant ces découpages (champs absents)", () => {
    const { revenueByMonthDsp: _a, trackRevenue: _b, countryRevenue: _c, ...old } = build(DISTROKID_CSV);
    expect(validateUserData(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });
  it("accepte un remboursement (revenu négatif) dans un découpage", () => {
    const ok = build(DISTROKID_CSV);
    const refund = { ...ok, trackRevenue: { ...ok.trackRevenue, "Titre remboursé": -3.2 } };
    expect(validateUserData(refund)?.trackRevenue?.["Titre remboursé"]).toBe(-3.2);
  });
  it("refuse une forme trafiquée", () => {
    const ok = build(DISTROKID_CSV);
    expect(validateUserData({ ...ok, version: 2 })).toBeNull();
    expect(validateUserData({ ...ok, totalStreams: -5 })).toBeNull();
    expect(validateUserData({ ...ok, months: ["pas-un-mois"] })).toBeNull();
    expect(validateUserData({ ...ok, streamsByMonth: { "2026-03": { napster: 10 } } })).toBeNull();
    expect(validateUserData({ ...ok, trackStreams: Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`t${i}`, 1])) })).toBeNull();
    expect(validateUserData({ ...ok, revenueByMonthDsp: { "2026-03": { napster: 10 } } })).toBeNull();
    expect(validateUserData({ ...ok, countryRevenue: { France: 10 } })).toBeNull();
    expect(validateUserData({ ...ok, trackRevenue: { a: Number.NaN } })).toBeNull();
    expect(validateUserData("n'importe quoi")).toBeNull();
  });
});
