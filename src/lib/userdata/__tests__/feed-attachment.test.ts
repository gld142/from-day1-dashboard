/**
 * Pièces jointes traduites par Day One (feed-attachment.ts), dans les deux langues, avec un
 * traducteur qui LÈVE sur une clé absente (onError). Les chiffres attendus sont recalculés ici
 * depuis les mêmes sources (estimations Day One, data.ts), jamais recopiés.
 *
 * Relevé : construit depuis l'estimation Day One de Leto (artiste des deux maisons) sur juillet →
 * septembre 2026, Deezer payé à 70 % : l'écart doit tomber sur Deezer, à l'euro.
 */
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { CONTRACTS, dailyEstimates } from "@/lib/demo/api";
import type { DSP } from "@/lib/demo/types";
import frAttach from "@/messages/fr/filattach.json";
import enAttach from "@/messages/en/filattach.json";
import {
  ATTACHMENT_MAX_BYTES,
  csvToRows,
  isAttachmentError,
  looseNumber,
  readAttachment,
  translateContract,
  translateText,
  type AttachmentCtx,
  type AttachmentResult,
  type AttachT,
  type FeedAttachment,
} from "../feed-attachment";
import { xlsxFromRows } from "./xlsx-fixture";

const MESSAGES = { fr: frAttach, en: enAttach } as const;
type Locale = keyof typeof MESSAGES;

function translator(locale: Locale): AttachT {
  const tr = createTranslator({
    locale,
    messages: { filattach: MESSAGES[locale] },
    namespace: "filattach",
    onError: (e) => {
      throw e;
    },
  });
  return (key, values) => tr(key as never, values as never);
}

const NOW = new Date("2026-10-28T10:00:00Z");
const ctx = (locale: Locale, over: Partial<AttachmentCtx> = {}): AttachmentCtx => ({
  t: translator(locale),
  locale,
  by: { role: "finance", name: "Finance · Thomas" },
  now: NOW,
  today: "2026-10-24",
  ...over,
});

const widen = (s: string) => s.replace(/ /g, " ");
const eur = (locale: Locale, n: number) =>
  widen(new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n));

/** Le montant formaté, entier : « 500 € » ne se lit pas dans « 20 500 € ». */
const hasAmount = (s: string | undefined, amount: string) =>
  new RegExp(`(^|[^\\d\u00a0.,])${amount.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`).test(s ?? "");

function ok(r: AttachmentResult): FeedAttachment {
  if (isAttachmentError(r)) throw new Error(`erreur inattendue : ${r.error}`);
  return r;
}

/** Forme commune : 2 à 4 chiffres et points, aucun texte vide, aucune accolade ICU non résolue. */
function expectWellFormed(a: FeedAttachment) {
  expect(a.figures.length).toBeGreaterThanOrEqual(2);
  expect(a.figures.length).toBeLessThanOrEqual(4);
  expect(a.points.length).toBeGreaterThanOrEqual(2);
  expect(a.points.length).toBeLessThanOrEqual(4);
  expect(Object.keys(a.forRoles).length).toBeGreaterThan(0);
  const texts = [a.headline, ...a.figures.flatMap((f) => [f.label, f.value]), ...a.points, ...Object.values(a.forRoles)];
  for (const s of texts) {
    expect(s, JSON.stringify(a)).toBeTruthy();
    expect(s).not.toMatch(/[{}]|undefined|NaN/);
  }
  expect(a.addedAt).toBe(NOW.toISOString());
  expect(a.addedBy).toEqual({ role: "finance", name: "Finance · Thomas" });
}

/* ─── Le relevé de Leto, construit depuis l'estimation Day One ─── */

const MONTHS = ["2026-07", "2026-08", "2026-09"];
const DSPS: Array<[DSP, string]> = [
  ["spotify", "Spotify"],
  ["apple", "Apple Music"],
  ["deezer", "Deezer"],
  ["amazon", "Amazon Music"],
];
const PAID: Partial<Record<DSP, number>> = { deezer: 0.7 };
const round2 = (n: number) => Math.round(n * 100) / 100;

const expected: Record<string, Partial<Record<DSP, number>>> = {};
for (const d of dailyEstimates("leto", 730)) {
  const m = d.date.slice(0, 7);
  if (!MONTHS.includes(m)) continue;
  for (const [dsp] of DSPS) (expected[m] ??= {})[dsp] = (expected[m][dsp] ?? 0) + (d.byDsp[dsp]?.gross.mid ?? 0);
}
/** Lignes du relevé : par mois × plateforme, 60 % « GHALAT » en France, 40 % « Nuit » en Belgique. */
const lines: Array<[string, string, string, string, string, number, number]> = [];
for (const m of MONTHS)
  for (const [dsp, store] of DSPS) {
    const amount = (expected[m][dsp] ?? 0) * (PAID[dsp] ?? 1);
    lines.push([m, store, "Leto", "GHALAT", "FR", 120_000, round2(amount * 0.6)]);
    lines.push([m, store, "Leto", "Nuit", "BE", 80_000, round2(amount * 0.4)]);
  }
const HEADER = ["Sales Month", "Platform", "Artist", "Track title", "Country", "Nb of streams", "Net income (EUR)"];
const CSV = [HEADER.join(";"), ...lines.map((l) => l.join(";"))].join("\n");

const received = lines.reduce((s, l) => s + l[6], 0);
const expTotal = MONTHS.reduce((s, m) => s + DSPS.reduce((x, [d]) => x + (expected[m][d] ?? 0), 0), 0);
const deezerExp = MONTHS.reduce((s, m) => s + (expected[m].deezer ?? 0), 0);
const deezerRec = lines.filter((l) => l[1] === "Deezer").reduce((s, l) => s + l[6], 0);
const leto = CONTRACTS.find((c) => c.artistId === "leto")!;
const auditDue = leto.alerts.find((a) => a.kind === "audit-window")!.dueDate!;

describe("relevé CSV (Believe) de Leto, Deezer payé à 70 %", () => {
  it("témoin : l'estimation existe et le relevé porte de vrais montants", () => {
    expect(deezerExp).toBeGreaterThan(10_000);
    expect(received).toBeGreaterThan(100_000);
    expect(auditDue >= "2026-10-24").toBe(true);
  });

  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : total, écart et réclamation à l'euro, une ligne par service`, () => {
      const a = ok(translateText("releve-believe-T3.csv", CSV, ctx(locale, { artistId: "leto" })));
      expectWellFormed(a);
      expect(a.kind).toBe("statement");
      expect(a.headline).toContain(eur(locale, received));
      expect(a.headline).toContain("Leto");
      expect(a.figures[0].value).toBe(eur(locale, received));
      const gapFigure = a.figures.find((f) => f.label === MESSAGES[locale].statement.figures.gap);
      expect(gapFigure?.value).toContain(eur(locale, received - expTotal).replace("-", "").replace("−", ""));
      // Finance : réclamer le manque Deezer, avant la fin de la fenêtre d'audit du contrat.
      const shortfall = eur(locale, deezerExp - deezerRec);
      expect(a.forRoles.finance).toContain(shortfall);
      expect(a.forRoles.finance).toContain("Deezer");
      expect(a.forRoles.finance).toContain(new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${auditDue}T00:00:00Z`)));
      expect(a.forRoles.da).toContain("GHALAT");
      expect(a.forRoles.da).toContain("60");
      expect(a.forRoles.juridique).toContain(shortfall);
      expect(a.forRoles.direction).toContain("Deezer");
      expect(a.forRoles.presidence).toBeTruthy();
      expect(a.points[0]).toContain("Deezer");
      expect(a.points.join(" ")).toContain("GHALAT");
    });
  }

  it("sans artiste dans la note : l'artiste est reconnu par son nom dans le relevé", () => {
    const a = ok(translateText("releve.csv", CSV, ctx("fr")));
    expect(a.headline).toContain("Leto");
    expect(a.forRoles.finance).toContain("Deezer");
  });

  it("XLSX : même relevé, avec une ligne de titre et une ligne vide avant les colonnes", async () => {
    const bytes = await xlsxFromRows([["Relevé Believe T3 2026"], [], HEADER, ...lines]);
    const file = new File([bytes as BlobPart], "Releve T3.xlsx");
    const a = ok(await readAttachment(file, ctx("fr", { artistId: "leto" })));
    expect(a.kind).toBe("statement");
    expect(a.name).toBe("Releve T3.xlsx");
    expect(a.figures[0].value).toBe(eur("fr", received));
    expect(a.forRoles.finance).toContain(eur("fr", deezerExp - deezerRec));
  });
});

describe("relevé DistroKid en dollars, artiste hors roster", () => {
  const DK = `Reporting Date,Sale Month,Store,Artist,Title,ISRC,UPC,Quantity,Team Percentage,Song/Album,Country of Sale,Songwriter Royalties Withheld,Earnings (USD)
2026-05-15,2026-03,Spotify,Mon Projet,Premier Titre,FR1234567890,123456789012,15230,100,Song,FR,1.5,45.69
2026-05-15,2026-03,Apple Music,Mon Projet,Premier Titre,FR1234567890,123456789012,3120,100,Song,FR,0,18.72
2026-05-15,2026-04,Deezer,Mon Projet,Deuxième Titre,FR1234567891,123456789012,2100,100,Song,BE,0,7.14`;
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : montants en USD, pas de comparaison à l'attendu, retenues signalées`, () => {
      const a = ok(translateText("distrokid.csv", DK, ctx(locale)));
      expectWellFormed(a);
      expect(a.kind).toBe("statement");
      expect(a.headline).toContain("DistroKid");
      expect(a.headline).toMatch(/71[.,]55/);
      expect(a.points.join(" ")).toContain("USD");
      expect(a.forRoles.finance).toBeTruthy();
      expect(a.forRoles.juridique).toMatch(/1[.,]50/); // retenues à la source
    });
  }
});

describe("tableau qui n'est pas un relevé", () => {
  const BUDGET = `Budget marketing T4\n\nPoste;Budget (€);Année\nClip « GHALAT »;12 000;2026\nPromo radio;8 500;2026\nTotal;21 000;`;
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : lignes, total, et la ligne « Total » du fichier contrôlée`, () => {
      const a = ok(translateText("budget-T4.csv", BUDGET, ctx(locale)));
      expectWellFormed(a);
      expect(a.kind).toBe("sheet");
      expect(a.figures[0].value).toBe("2");
      expect(a.figures.some((f) => f.value === eur(locale, 20_500))).toBe(true);
      expect(hasAmount(a.points[0], eur(locale, 500)), a.points[0]).toBe(true); // 21 000 annoncés, 20 500 additionnés
      expect(hasAmount(a.forRoles.finance, eur(locale, 500)), a.forRoles.finance).toBe(true);
      expect(hasAmount("20\u00a0500\u00a0€", "500\u00a0€")).toBe(false); // témoin de l'assertion
      expect(a.forRoles.da).toContain("GHALAT");
      // « Année » n'est pas additionnée.
      expect(a.points.join(" ")).not.toContain("4052");
    });
  }

  it("nombres « à la française » et « à l'anglaise »", () => {
    expect(looseNumber("12 400,50 €")).toBe(12400.5);
    expect(looseNumber("1.234,56")).toBe(1234.56);
    expect(looseNumber("1,234.56")).toBe(1234.56);
    expect(looseNumber("45.689")).toBe(45.689); // valeur brute d'un XLSX : jamais des milliers
    expect(looseNumber("(300)")).toBe(-300);
    expect(looseNumber("12 %")).toBeNull();
    expect(looseNumber("2026-03")).toBeNull();
  });

  it("CSV : guillemets, séparateur point-virgule, retour à la ligne entre guillemets", () => {
    expect(csvToRows('a;"b;c";"d\ne"\nf;g')).toEqual([["a", "b;c", "d\ne"], ["f", "g"]]);
  });
});

describe("erreurs claires", () => {
  for (const locale of ["fr", "en"] as const) {
    const m = MESSAGES[locale].errors;
    it(`${locale} : PDF, Word, .xls, format inconnu, trop gros, vide, illisible`, async () => {
      const read = (parts: BlobPart[], name: string) => readAttachment(new File(parts, name), ctx(locale));
      expect(await read(["%PDF-1.7 …"], "releve.pdf")).toEqual({ error: m.pdf });
      expect(await read(["%PDF-1.7 …"], "renomme.csv")).toEqual({ error: m.pdf }); // le contenu prime
      expect(await read(["PK"], "contrat.docx")).toEqual({ error: m.word });
      expect(await read(["x"], "vieux.xls")).toEqual({ error: m.xls.replace("{ext}", "xls") });
      expect(await read(["x"], "photo.png")).toEqual({ error: m.unsupported.replace("{ext}", "png") });
      expect(await read([], "vide.csv")).toEqual({ error: m.empty });
      const big = await read([new Uint8Array(ATTACHMENT_MAX_BYTES + 1)], "gros.csv");
      expect(isAttachmentError(big) && big.error).toMatch(/5/);
      const broken = await read([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], "casse.xlsx");
      expect(isAttachmentError(broken) && broken.error).toContain("casse.xlsx");
      // Un PDF n'est jamais un succès, même joint sous un autre nom : il propose CSV / XLSX.
      expect(m.pdf).toMatch(/CSV/);
      expect(m.pdf).toMatch(/xlsx/);
    });
  }
});

describe("contrat traduit", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : Leto — avance, taux, reste à recouper, échéance, une ligne par service`, () => {
      const a = ok(translateContract("leto", ctx(locale)));
      expectWellFormed(a);
      expect(a.kind).toBe("contract");
      const remaining = leto.advance - (leto.advance * leto.recoupedPct) / 100;
      expect(remaining).toBeGreaterThan(0); // témoin : un contrat pas encore recoupé
      expect(a.figures.map((f) => f.value)).toEqual(
        expect.arrayContaining([eur(locale, leto.advance), eur(locale, remaining)]),
      );
      expect(a.figures.some((f) => f.value.includes(String(leto.royaltyRate)))).toBe(true);
      expect(a.forRoles.finance).toContain(eur(locale, remaining));
      expect(a.forRoles.juridique).toBeTruthy();
      expect(a.forRoles.da).toContain("Leto");
      expect(a.forRoles.direction).toContain(eur(locale, remaining));
      expect(a.forRoles.presidence).toBeTruthy();
    });

    it(`${locale} : chaque contrat de la maison se traduit sans clé manquante`, () => {
      for (const c of CONTRACTS) expectWellFormed(ok(translateContract(c.artistId, ctx(locale))));
    });

    it(`${locale} : un artiste sans contrat, ou pas d'artiste → erreur claire`, () => {
      const none = translateContract("gustave-rudman", ctx(locale));
      expect(isAttachmentError(none) && none.error).toContain("Gustave Rudman");
      expect(translateContract(null, ctx(locale))).toEqual({ error: MESSAGES[locale].errors.noArtist });
    });
  }

  it("une option à lever : le Juridique a sa date", () => {
    const louane = CONTRACTS.find((c) => c.artistId === "louane")!;
    const option = louane.alerts.find((x) => x.kind === "option")!;
    const a = ok(translateContract("louane", ctx("fr")));
    expect(a.forRoles.juridique).toContain(new Intl.DateTimeFormat("fr", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${option.dueDate}T00:00:00Z`)));
    expect(a.forRoles.juridique).toMatch(/option/i);
  });
});

/* Garde-fou ajouté le 28/10 : un relevé NET de la commission du distributeur (≈ 85 % partout)
   ne doit pas devenir « Réclamer » — c'est un taux uniforme, pas un manque chez une plateforme. */
describe("relevé net de commission (85 % sur toutes les plateformes) : pas de réclamation", () => {
  const uniformLines = MONTHS.flatMap((m) =>
    DSPS.map(([dsp, store]) => [m, store, "Leto", "GHALAT", "FR", 120_000, round2((expected[m][dsp] ?? 0) * 0.85)] as const),
  );
  const uniformCsv = [HEADER.join(";"), ...uniformLines.map((l) => l.join(";"))].join("\n");

  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : « à vérifier », jamais « réclamer »`, () => {
      const a = ok(translateText("releve-net.csv", uniformCsv, ctx(locale, { artistId: "leto" })));
      const commission = MESSAGES[locale].statement.points.commission.split("{pct}")[0];
      expect(a.points.some((p) => p.startsWith(commission))).toBe(true);
      const claimStart = MESSAGES[locale].statement.roles.financeClaimBy.split("{")[0];
      expect(a.forRoles.finance?.startsWith(claimStart)).toBe(false);
    });
  }
});
