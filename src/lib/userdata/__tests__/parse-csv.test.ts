import { describe, expect, it } from "vitest";
import { parseStatement, storeToDsp } from "../parse-csv";

const DISTROKID_CSV = `Reporting Date,Sale Month,Store,Artist,Title,ISRC,UPC,Quantity,Team Percentage,Song/Album,Country of Sale,Songwriter Royalties Withheld,Earnings (USD)
2026-05-15,2026-03,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,15230,100,Song,FR,0,45.69
2026-05-15,2026-03,Apple Music,Mon Projet,Premier Titre,FR1234567890,123456789012,3120,100,Song,FR,0,18.72
2026-05-15,2026-03,Spotify,Mon Projet,Deuxième Titre,FR1234567891,123456789012,8450,100,Song,BE,0,25.35
2026-05-15,2026-04,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,18900,100,Song,FR,0,56.70
2026-05-15,2026-04,Deezer,Mon Projet,Deuxième Titre,FR1234567891,123456789012,2100,100,Song,FR,0,7.14
2026-05-15,2026-04,YouTube (Audio),Mon Projet,Premier Titre,FR1234567890,123456789012,5600,100,Song,US,0,4.48`;

const TUNECORE_CSV = `Sales Period;Store Name;Artist;Release Type;Song Title;Units Sold;Total Earned
2026-01;Spotify;Autre Artiste;Single;Titre A;12000;36,50
2026-01;Apple Music;Autre Artiste;Single;Titre A;2400;13,20
2026-02;Spotify;Autre Artiste;Single;Titre B;9800;29,10`;

describe("parseStatement — DistroKid", () => {
  const p = parseStatement(DISTROKID_CSV);

  it("détecte le format et la devise", () => {
    expect(p.format).toBe("distrokid");
    expect(p.currency).toBe("USD");
  });

  it("agrège les streams par mois et par DSP", () => {
    expect(p.streamsByMonth["2026-03"]?.spotify).toBe(15230 + 8450);
    expect(p.streamsByMonth["2026-03"]?.apple).toBe(3120);
    expect(p.streamsByMonth["2026-04"]?.youtube).toBe(5600);
    expect(p.totalStreams).toBe(15230 + 3120 + 8450 + 18900 + 2100 + 5600);
  });

  it("agrège les revenus par mois", () => {
    expect(p.revenueByMonth["2026-03"]).toBeCloseTo(45.69 + 18.72 + 25.35, 2);
    expect(p.revenueByMonth["2026-04"]).toBeCloseTo(56.7 + 7.14 + 4.48, 2);
  });

  it("agrège titres et territoires", () => {
    expect(p.trackStreams["Premier Titre"]).toBe(15230 + 3120 + 18900 + 5600);
    expect(p.countryStreams["FR"]).toBe(15230 + 3120 + 18900 + 2100);
    expect(p.countryStreams["US"]).toBe(5600);
  });

  it("liste les mois triés", () => {
    expect(p.months).toEqual(["2026-03", "2026-04"]);
  });
});

describe("parseStatement — TuneCore (point-virgule, virgule décimale)", () => {
  const p = parseStatement(TUNECORE_CSV);

  it("détecte le format", () => {
    expect(p.format).toBe("tunecore");
  });

  it("parse les nombres à virgule décimale", () => {
    expect(p.revenueByMonth["2026-01"]).toBeCloseTo(36.5 + 13.2, 2);
  });

  it("détecte l'artiste", () => {
    expect(p.artistNames).toContain("Autre Artiste");
  });
});

describe("parseStatement — erreurs", () => {
  it("rejette un fichier vide", () => {
    expect(() => parseStatement("")).toThrow("EMPTY_FILE");
  });

  it("rejette un format inconnu", () => {
    expect(() => parseStatement("a,b,c\n1,2,3")).toThrow("UNKNOWN_FORMAT");
  });
});

describe("storeToDsp", () => {
  it("mappe les stores courants", () => {
    expect(storeToDsp("Spotify")).toBe("spotify");
    expect(storeToDsp("Apple Music")).toBe("apple");
    expect(storeToDsp("iTunes")).toBe("apple");
    expect(storeToDsp("YouTube (Audio)")).toBe("youtube");
    expect(storeToDsp("TikTok/Resso")).toBe("tiktok");
    expect(storeToDsp("Boutique Inconnue")).toBe("other");
  });
});
