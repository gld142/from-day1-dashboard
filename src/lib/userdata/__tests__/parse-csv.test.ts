import { describe, expect, it } from "vitest";
import { parseStatement, storeToDsp } from "../parse-csv";
import { buildUserData } from "../store";
import { validateUserData } from "../validate";

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

  it("garde les revenus par plateforme, mois par mois", () => {
    expect(p.revenueByMonthDsp["2026-03"]?.spotify).toBeCloseTo(45.69 + 25.35, 2);
    expect(p.revenueByMonthDsp["2026-03"]?.apple).toBeCloseTo(18.72, 2);
    expect(p.revenueByMonthDsp["2026-04"]?.youtube).toBeCloseTo(4.48, 2);
  });

  it("garde les revenus par titre et par pays", () => {
    expect(p.trackRevenue["Premier Titre"]).toBeCloseTo(45.69 + 18.72 + 56.7 + 4.48, 2);
    expect(p.trackRevenue["Deuxième Titre"]).toBeCloseTo(25.35 + 7.14, 2);
    expect(p.countryRevenue["FR"]).toBeCloseTo(45.69 + 18.72 + 56.7 + 7.14, 2);
    expect(p.countryRevenue["US"]).toBeCloseTo(4.48, 2);
  });

  it("les découpages de revenus retombent sur le total", () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    const byDsp = Object.values(p.revenueByMonthDsp).reduce((a, m) => a + sum(m as Record<string, number>), 0);
    expect(byDsp).toBeCloseTo(p.totalRevenue, 2);
    expect(sum(p.trackRevenue)).toBeCloseTo(p.totalRevenue, 2);
    expect(sum(p.countryRevenue)).toBeCloseTo(p.totalRevenue, 2);
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

describe("parseStatement — détail gardé à l'import (29/09/2026)", () => {
  const p = parseStatement(DISTROKID_CSV);

  it("titre × mois : streams et revenus", () => {
    expect(p.trackMonthStreams["Premier Titre"]).toEqual({ "2026-03": 15230 + 3120, "2026-04": 18900 + 5600 });
    expect(p.trackMonthRevenue["Deuxième Titre"]["2026-03"]).toBeCloseTo(25.35, 2);
    expect(p.trackMonthRevenue["Deuxième Titre"]["2026-04"]).toBeCloseTo(7.14, 2);
  });

  it("pays × mois : streams et revenus", () => {
    expect(p.countryMonthStreams.FR).toEqual({ "2026-03": 15230 + 3120, "2026-04": 18900 + 2100 });
    expect(p.countryMonthRevenue.US["2026-04"]).toBeCloseTo(4.48, 2);
  });

  it("ISRC de chaque titre (sans tirets, en majuscules)", () => {
    expect(p.trackIsrc).toEqual({ "Premier Titre": "FR1234567890", "Deuxième Titre": "FR1234567891" });
  });

  it("mois de vente → mois du relevé : de quoi mesurer le délai de paiement", () => {
    expect(p.saleReportRevenue["2026-03>2026-05"]).toBeCloseTo(45.69 + 18.72 + 25.35, 2);
    expect(p.saleReportRevenue["2026-04>2026-05"]).toBeCloseTo(56.7 + 7.14 + 4.48, 2);
  });

  it("retenues et revenus par artiste crédité", () => {
    expect(p.withheld).toBe(0);
    expect(p.artistRevenue["Mon Projet"]).toBeCloseTo(p.totalRevenue, 2);
  });

  it("TuneCore : ni date de relevé ni ISRC → rien d'inventé", () => {
    const t = parseStatement(TUNECORE_CSV);
    expect(t.saleReportRevenue).toEqual({});
    expect(t.trackIsrc).toEqual({});
    expect(t.trackMonthStreams["Titre A"]).toEqual({ "2026-01": 14400 });
  });

  it("en-tête « Sales Month » : le mois de VENTE, pas celui du relevé", () => {
    const csv = `Sales Month;Reporting Month;Platform;Artist;Title;ISRC;Nb of Streams;Net Income;Country
2026-02;2026-04;Spotify;X;T1;FR-ABC-26-00001;1000;3,10;FR
2026-03;2026-05;Deezer;X;T1;FR-ABC-26-00001;500;2,00;FR`;
    const b = parseStatement(csv);
    expect(b.months).toEqual(["2026-02", "2026-03"]);
    expect(b.saleReportRevenue).toEqual({ "2026-02>2026-04": 3.1, "2026-03>2026-05": 2 });
    expect(b.trackIsrc).toEqual({ T1: "FRABC2600001" });
  });

  it("retenues DistroKid additionnées", () => {
    const csv = DISTROKID_CSV.replace("FR,0,45.69", "FR,1.25,45.69").replace("FR,0,56.70", "FR,0.75,56.70");
    expect(parseStatement(csv).withheld).toBeCloseTo(2, 2);
  });
});

describe("seuil Spotify : streams Spotify par titre sur les 12 derniers mois du relevé", () => {
  it("fenêtre = 12 derniers mois du relevé ; seules les lignes Spotify comptent", () => {
    const p = parseStatement(DISTROKID_CSV);
    // Premier Titre : Spotify 15 230 (mars) + 18 900 (avril) ; Apple et YouTube exclus
    expect(p.trackSpotify12).toEqual({ "Premier Titre": 15230 + 18900, "Deuxième Titre": 8450 });
    expect(p.spotifyWindow).toEqual({ from: "2026-03", to: "2026-04", months: 2 });
  });
  it("un relevé de 14 mois : les 2 plus anciens sortent de la fenêtre", () => {
    const rows = Array.from({ length: 14 }, (_, i) => {
      const m = new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 7);
      return `2026-12-15,${m},Spotify,X,T,,,${100},100,Song,FR,0,1.00`;
    });
    const p = parseStatement([DISTROKID_CSV.split("\n")[0], ...rows].join("\n"));
    expect(p.trackSpotify12).toEqual({ T: 1200 });
    expect(p.spotifyWindow).toEqual({ from: "2025-03", to: "2026-02", months: 12 });
  });
});

describe("relevé au format Symphonic (colonnes de leur documentation, lue le 29/09/2026)", () => {
  const SYMPHONIC = `Reporting Period,Label,Release Name,Release Version,Release Artists,UPC Code,Catalogue,Track Title,Mix Version,ISRC Code,Track Artist,Digital Service Provider,Activity Period,Territory,Delivery,Content Type,Sale or Void,Count,Royalty ($US)
2025-08-31,Mon Label,Album,,Artiste A,123,,Titre 1,,FRABC2500001,Artiste A,Spotify,2025-06-30,SEN,Streaming,Single,Sale,1000,3.00
2025-08-31,Mon Label,Album,,Artiste A,123,,Titre 1,,FRABC2500001,Artiste A,Apple Music,2025-06-30,AUT,Streaming,Single,Sale,500,2.50
2025-08-31,Mon Label,Album,,Artiste A,123,,Titre 1,,FRABC2500001,Artiste A,Spotify,2025-07-31,FRA,Streaming,Single,Void,-100,-0.30`;
  const p = parseStatement(SYMPHONIC);
  it("mois d'ÉCOUTE (Activity Period), pas le mois du relevé", () => {
    expect(p.months).toEqual(["2025-06", "2025-07"]);
    expect(p.saleReportRevenue["2025-06>2025-08"]).toBeCloseTo(5.5);
  });
  it("pays en 3 lettres convertis (SEN = Sénégal, pas la Suède ; AUT = Autriche)", () => {
    expect(Object.keys(p.countryStreams).sort()).toEqual(["AT", "SN"]);
  });
  it("plateforme, quantité (Count), montant en dollars, artiste, retour (Void) déduit", () => {
    expect(p.currency).toBe("USD");
    expect(p.streamsByMonth["2025-06"]).toEqual({ spotify: 1000, apple: 500 });
    expect(p.revenueByMonth["2025-07"]).toBeCloseTo(-0.3);
    expect(p.artistRevenue["Artiste A"]).toBeCloseTo(5.2);
    expect(p.trackIsrc["Titre 1"]).toBe("FRABC2500001");
  });
  it("pays en toutes lettres (anglais ou français) et dates jour/mois", () => {
    const csv = `Date,Store,Title,Quantity,Earnings (EUR),Country
30/06/2025,Spotify,T,100,1.00,Spain
15/07/2025,Deezer,T,100,1.00,Allemagne
07/31/2025,Deezer,T,100,1.00,FR`;
    const q = parseStatement(csv);
    expect(Object.keys(q.countryStreams).sort()).toEqual(["DE", "ES", "FR"]);
    expect(q.months).toEqual(["2025-06", "2025-07"]);
  });
});

describe("annulations (quantités négatives)", () => {
  it("le total des streams = somme des compteurs après annulation ; le relevé reste valide", () => {
    const csv = `Sale Month,Store,Title,Quantity,Earnings (EUR),Country
2026-01,Spotify,T,1000,4.00,FR
2026-01,Spotify,T,-200,-0.80,FR
2026-02,Deezer,T,-50,-0.20,BE`;
    const p = parseStatement(csv);
    expect(p.streamsByMonth).toEqual({ "2026-01": { spotify: 800 }, "2026-02": {} });
    expect(p.totalStreams).toBe(800);
    expect(p.countryStreams).toEqual({ FR: 800 });
    expect(p.revenueByMonth["2026-02"]).toBeCloseTo(-0.2);
    const d = buildUserData(p, { artistName: "A", eurRate: 1 });
    expect(validateUserData(JSON.parse(JSON.stringify(d)))).not.toBeNull();
    // Témoin de l'ancien défaut : un compteur négatif fait refuser tout le relevé.
    expect(validateUserData({ ...d, countryStreams: { ...d.countryStreams, BE: -50 } })).toBeNull();
  });
});
