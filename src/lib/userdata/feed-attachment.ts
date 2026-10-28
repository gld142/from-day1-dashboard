/**
 * Pièce jointe du fil « traduite par Day One » : un relevé, un tableau Excel ou un contrat, résumé
 * en langage clair pour les services qui ne l'ont pas produit — chiffres clés, points, et une ligne
 * « pour toi » par service (ce que ça change, concrètement).
 *
 * Fonctions PURES (aucune horloge, aucun stockage, aucun réseau) : la date (`now`), le jour de la
 * démo (`today`), la langue et le traducteur (`t`, namespace `filattach`) sont injectés. Les textes
 * sont figés dans la langue de l'action, comme l'auteur d'une note (`fromName`).
 *
 * Sources des chiffres :
 * - le fichier lui-même (`parseStatement`, ou la feuille lue telle quelle) ;
 * - l'attendu d'un relevé = l'estimation Day One du brut master par plateforme et par mois
 *   (`dailyEstimates`, la même base que les écarts DSP de /audit), sur les seuls mois COMPLETS et
 *   les seules plateformes présents dans le relevé ; seuils de réclamation de /audit
 *   (`AUDIT_GAP_ABS_EUR`, `AUDIT_GAP_REL`) ;
 * - le contrat = `CONTRACTS` (data.ts), le reste à recouper compté comme /contracts.
 */
import { ARTISTS, CONTRACTS, dailyEstimates } from "@/lib/demo/api";
import { DEMO_TODAY, isoDay } from "@/lib/demo/seed";
import type { Contract, ContractAlert, DSP } from "@/lib/demo/types";
import { AUDIT_GAP_ABS_EUR, AUDIT_GAP_REL } from "@/lib/real/params";
import type { JobRole } from "@/lib/roles";
import { parseStatement, type ParsedStatement } from "./parse-csv";
import { looksLikeZip, readXlsx, rowsToCsv, XlsxError } from "./xlsx-lite";

/* ─────────── Types publics ─────────── */

export type FeedAttachmentKind = "statement" | "sheet" | "contract";

export type FeedAttachment = {
  id: string;
  name: string;
  kind: FeedAttachmentKind;
  addedAt: string;
  addedBy: { role: JobRole | null; name: string };
  /** Texte figé dans la langue de l'action (comme `fromName` des notes). */
  headline: string;
  /** 2 à 4 chiffres clés, déjà formatés. */
  figures: { label: string; value: string }[];
  /** 2 à 4 phrases claires. */
  points: string[];
  /** « Ce que ça change pour toi », par service. Un service sans rien de concret n'a pas de ligne. */
  forRoles: Partial<Record<JobRole, string>>;
};

export type AttachmentError = { error: string };
export type AttachmentResult = FeedAttachment | AttachmentError;

/** Traducteur du namespace `filattach` (`useTranslations("filattach")` côté client). */
export type AttachT = (key: string, values?: Record<string, string | number>) => string;

export type AttachmentCtx = {
  t: AttachT;
  locale: string;
  /** Qui joint la pièce (figé, comme l'auteur d'une note). */
  by: { role: JobRole | null; name: string };
  /** Horodatage de l'action (addedAt, id). */
  now: Date;
  /** L'artiste de la note, s'il y en a un. */
  artistId?: string | null;
  artistName?: string | null;
  /** Jour de la démo AAAA-MM-JJ pour les échéances (défaut : DEMO_TODAY, comme le fil). */
  today?: string;
  /** Taux BCE « euros pour 1 unité de la devise du fichier » par mois AAAA-MM (`/api/fx`), facultatif. */
  eurPerUnit?: Record<string, number>;
};

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
/** Extensions que le sélecteur propose (`accept` de l'input). */
export const ATTACHMENT_ACCEPT =
  ".csv,.tsv,.txt,.xlsx,.xlsm,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function isAttachmentError(r: AttachmentResult): r is AttachmentError {
  return "error" in r;
}

/* ─────────── Formatage (Intl, jamais de format en dur) ─────────── */

const widen = (s: string) => s.replace(/ /g, " ");

type Currency = "EUR" | "USD" | "GBP";

/** Centimes seulement sous 1 000 et quand il y en a : « 71,55 $US », « 500 € », « 12 400 € ». */
const digitsFor = (n: number) => (Math.abs(n) >= 1000 || Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);

function money(locale: string, n: number, currency: Currency = "EUR"): string {
  const digits = digitsFor(n);
  return widen(
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
  );
}
const signedMoney = (locale: string, n: number, currency: Currency = "EUR") =>
  widen(
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digitsFor(n),
      maximumFractionDigits: digitsFor(n),
      signDisplay: "exceptZero",
    }).format(n),
  );
const share = (locale: string, ratio: number) =>
  widen(new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio));
const signedPct = (locale: string, ratio: number) =>
  widen(
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: Math.abs(ratio) < 0.1 ? 1 : 0,
      signDisplay: "exceptZero",
    }).format(ratio),
  );
const plainNumber = (locale: string, n: number) =>
  widen(new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 }).format(n));
const compact = (locale: string, n: number) =>
  widen(new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n));
const date = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
const list = (locale: string, items: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(items);

/** « juil. – sept. 2026 », « mars 2026 ». */
function monthRange(locale: string, months: string[]): string {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const d = (m: string) => new Date(`${m}-01T00:00:00Z`);
  const first = months[0];
  const last = months[months.length - 1];
  return widen(first === last ? fmt.format(d(first)) : fmt.formatRange(d(first), d(last)));
}

function countryName(locale: string, iso2: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

const sumValues = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const topEntries = (o: Record<string, number>, n: number) =>
  Object.entries(o)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

/* ─────────── Identité de la pièce ─────────── */

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function base(name: string, kind: FeedAttachmentKind, ctx: AttachmentCtx) {
  return {
    id: `att-${ctx.now.getTime().toString(36)}-${hash(`${kind}:${name}`)}`,
    name,
    kind,
    addedAt: ctx.now.toISOString(),
    addedBy: { role: ctx.by.role, name: ctx.by.name },
  };
}

const todayOf = (ctx: AttachmentCtx) => ctx.today ?? isoDay(DEMO_TODAY);
const rosterArtist = (id: string | null | undefined) => (id ? (ARTISTS.find((a) => a.id === id) ?? null) : null);
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/* ─────────── Lecture d'un fichier ─────────── */

const PDF = /^pdf$/;
const WORD = /^(docx?|odt|rtf|pages)$/;
const OLD_EXCEL = /^(xls|ods|numbers)$/;
const SPREADSHEET = /^(xlsx|xlsm)$/;
const TEXT = /^(csv|tsv|txt)$/;

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : "";
}

function sizeLabel(locale: string, bytes: number): string {
  return widen(new Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(bytes / 1024 / 1024));
}

/** UTF-8 d'abord ; un export Excel « CSV » français arrive souvent en Windows-1252. */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/**
 * Lit la pièce (CSV / TSV / XLSX, 5 Mo max) et la traduit : relevé de distributeur reconnu →
 * « statement », sinon tableau → « sheet ». PDF, Word, ancien .xls → erreur claire qui propose
 * CSV ou XLSX. Ne lève jamais : toute erreur revient en `{ error }`, dans la langue du traducteur.
 */
export async function readAttachment(file: File, ctx: AttachmentCtx): Promise<AttachmentResult> {
  const { t, locale } = ctx;
  const name = file.name || t("card.untitled");
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: t("errors.tooBig", { size: sizeLabel(locale, file.size) }) };
  if (file.size === 0) return { error: t("errors.empty") };
  const ext = extOf(name);
  if (PDF.test(ext)) return { error: t("errors.pdf") };
  if (WORD.test(ext)) return { error: t("errors.word") };
  if (OLD_EXCEL.test(ext)) return { error: t("errors.xls", { ext }) };
  if (ext && !SPREADSHEET.test(ext) && !TEXT.test(ext)) return { error: t("errors.unsupported", { ext }) };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Le contenu prime sur l'extension : un PDF renommé en .csv reste un PDF.
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { error: t("errors.pdf") };
    if (SPREADSHEET.test(ext) || looksLikeZip(bytes)) {
      if (!looksLikeZip(bytes)) return { error: t("errors.unreadable", { name }) };
      return translateRows(name, await readXlsx(bytes), ctx);
    }
    const text = decodeText(bytes);
    if (text.includes("\u0000")) return { error: t("errors.unreadable", { name }) };
    return translateText(name, text, ctx);
  } catch (e) {
    if (e instanceof XlsxError && e.code === "ENCRYPTED") return { error: t("errors.encrypted") };
    return { error: t("errors.unreadable", { name }) };
  }
}

/** Texte CSV / TSV → relevé si reconnu, sinon tableau. */
export function translateText(name: string, text: string, ctx: AttachmentCtx): AttachmentResult {
  const direct = tryStatement(text, ctx);
  if (direct) return statementAttachment(name, direct, ctx);
  return translateRows(name, csvToRows(text), ctx);
}

/** Lignes (d'un XLSX ou d'un CSV) → relevé si reconnu, sinon tableau. */
export function translateRows(name: string, rows: string[][], ctx: AttachmentCtx): AttachmentResult {
  const clean = rows.map((r) => r.map((c) => c.trim()));
  const h = headerIndex(clean);
  const body = clean.slice(h).filter((r) => r.some((c) => c !== ""));
  if (body.length < 2) return { error: ctx.t("errors.empty") };
  const parsed = tryStatement(rowsToCsv(body), ctx);
  if (parsed) return statementAttachment(name, parsed, ctx);
  return sheetAttachment(name, body, ctx);
}

/** Un relevé RECONNU : de l'argent, et un format de distributeur ou au moins une plateforme connue. */
function tryStatement(text: string, ctx: AttachmentCtx): ParsedStatement | null {
  try {
    const p = parseStatement(text, ctx.eurPerUnit ? { eurPerUnit: ctx.eurPerUnit } : {});
    const knownDsp = Object.values(p.revenueByMonthDsp).some((m) => Object.keys(m).some((d) => d !== "other"));
    return p.totalRevenue !== 0 && (p.format !== "generic" || knownDsp) ? p : null;
  } catch {
    return null;
  }
}

/* ─────────── CSV → lignes ─────────── */

/** CSV complet (guillemets, retours à la ligne entre guillemets), séparateur , ; ou tabulation. */
export function csvToRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const sample = clean.split("\n").slice(0, 20);
  const delim = [",", ";", "\t"]
    .map((d) => [d, Math.max(...sample.map((l) => l.split(d).length))] as const)
    .sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"' && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (c === delim) {
      row.push(cur.trim());
      cur = "";
    } else if (c === "\n") {
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * Ligne d'en-tête : la première (dans les 30 premières) assez remplie. Un export Excel commence
 * souvent par un titre (« Relevé T3 ») et une ligne vide avant les vraies colonnes.
 */
function headerIndex(rows: string[][]): number {
  const filled = rows.slice(0, 30).map((r) => r.filter((c) => c !== "").length);
  const max = Math.max(0, ...filled);
  const need = Math.max(2, Math.ceil(max * 0.6));
  const i = filled.findIndex((n) => n >= need);
  return i < 0 ? 0 : i;
}

/* ─────────── Relevé ─────────── */

type Gap = {
  expected: number;
  received: number;
  gap: number;
  ratio: number;
  /** La plateforme au plus gros manque, si elle passe les seuils de /audit. */
  claim: { dsp: DSP; shortfall: number; ratio: number } | null;
  /** Écart interprétable : le relevé est à l'échelle de l'estimation. */
  comparable: boolean;
  /**
   * Toutes les plateformes payées au même taux (ex. 85 % partout) : la signature d'un relevé net
   * de la commission du distributeur, pas d'un manque chez une plateforme. Pas de réclamation.
   */
  uniformCut: number | null;
};

/** Écart minimal entre la plateforme en cause et les autres pour parler de manque, pas de commission. */
const CLAIM_SPREAD = 0.1;
/** En dessous, même uniforme, le manque est trop gros pour n'être qu'une commission. */
const UNIFORM_FLOOR = 0.75;

/** Mois AAAA-MM couverts EN ENTIER par les estimations (le mois en cours est partiel). */
function completeMonths(days: string[]): Set<string> {
  const count = new Map<string, number>();
  for (const d of days) count.set(d.slice(0, 7), (count.get(d.slice(0, 7)) ?? 0) + 1);
  const out = new Set<string>();
  for (const [m, n] of count) {
    const [y, mo] = m.split("-").map(Number);
    if (n >= new Date(Date.UTC(y, mo, 0)).getUTCDate()) out.add(m);
  }
  return out;
}

/** Attendu (brut master estimé) vs reçu, plateforme par plateforme, sur les mois complets communs. */
function statementGap(p: ParsedStatement, artistId: string): Gap | null {
  const est = dailyEstimates(artistId, 730);
  if (!est.length) return null;
  const complete = completeMonths(est.map((d) => d.date));
  const months = p.months.filter((m) => complete.has(m));
  if (!months.length) return null;
  const inMonths = new Set(months);
  const received: Partial<Record<DSP, number>> = {};
  for (const m of months)
    for (const [dsp, v] of Object.entries(p.revenueByMonthDsp[m] ?? {}) as [DSP, number][])
      if (dsp !== "other") received[dsp] = (received[dsp] ?? 0) + v;
  const dsps = Object.keys(received) as DSP[];
  if (!dsps.length) return null;
  const expected: Partial<Record<DSP, number>> = {};
  for (const d of est) {
    if (!inMonths.has(d.date.slice(0, 7))) continue;
    for (const dsp of dsps) expected[dsp] = (expected[dsp] ?? 0) + (d.byDsp[dsp]?.gross.mid ?? 0);
  }
  const exp = dsps.reduce((s, d) => s + (expected[d] ?? 0), 0);
  const rec = dsps.reduce((s, d) => s + (received[d] ?? 0), 0);
  if (exp <= 0) return null;
  const ratio = rec / exp;
  let claim: Gap["claim"] = null;
  for (const dsp of dsps) {
    const e = expected[dsp] ?? 0;
    const shortfall = e - (received[dsp] ?? 0);
    if (e <= 0 || shortfall < AUDIT_GAP_ABS_EUR || shortfall / e < AUDIT_GAP_REL) continue;
    if (!claim || shortfall > claim.shortfall) claim = { dsp, shortfall, ratio: -shortfall / e };
  }
  // Manque chez UNE plateforme, ou taux uniforme ? On compare la plateforme en cause aux autres.
  let uniformCut: number | null = null;
  if (claim && ratio >= UNIFORM_FLOOR) {
    const others = dsps
      .filter((d) => d !== claim!.dsp && (expected[d] ?? 0) > 0)
      .map((d) => (received[d] ?? 0) / (expected[d] ?? 1))
      .sort((a, b) => a - b);
    const median = others.length ? others[Math.floor(others.length / 2)] : null;
    const claimRatio = 1 + claim.ratio;
    if (median === null || median - claimRatio < CLAIM_SPREAD) {
      uniformCut = ratio;
      claim = null;
    }
  }
  return { expected: exp, received: rec, gap: rec - exp, ratio, claim, comparable: ratio >= 0.4 && ratio <= 2.5, uniformCut };
}

/** L'artiste du relevé : celui de la note, sinon celui que nomme le relevé (un seul, du roster). */
function statementArtist(p: ParsedStatement, ctx: AttachmentCtx) {
  const fromNote = rosterArtist(ctx.artistId);
  if (fromNote) return fromNote;
  if (p.artistNames.length !== 1) return null;
  const n = norm(p.artistNames[0]);
  return ARTISTS.find((a) => norm(a.name) === n) ?? null;
}

const nextAuditWindow = (contracts: Contract[], today: string) =>
  contracts
    .flatMap((c) => c.alerts)
    .filter((a) => a.kind === "audit-window" && a.dueDate && a.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0] ?? null;

const remainingAdvance = (c: Contract) => Math.max(0, c.advance - (c.advance * c.recoupedPct) / 100);

export function statementAttachment(name: string, p: ParsedStatement, ctx: AttachmentCtx): FeedAttachment {
  const { t, locale } = ctx;
  const currency: Currency = p.fx || p.currency === "unknown" || p.currency === "EUR" ? "EUR" : p.currency;
  const inEuros = currency === "EUR";
  const m = (n: number) => money(locale, n, currency);
  const total = p.totalRevenue;
  const period = monthRange(locale, p.months);
  const format = t(`formats.${p.format}`);

  const artist = statementArtist(p, ctx);
  const n = artist ? norm(artist.name) : "";
  const multiArtist = p.artistNames.length > 1 && !p.artistNames.every((a) => norm(a).includes(n) && n !== "");
  const artistName = multiArtist ? null : (artist?.name ?? ctx.artistName ?? (p.artistNames.length === 1 ? p.artistNames[0] : null));
  const gap = artist && inEuros && !multiArtist ? statementGap(p, artist.id) : null;
  const useGap = gap?.comparable ? gap : null;
  const shortfall = useGap ? useGap.gap <= -AUDIT_GAP_ABS_EUR && -useGap.ratio + 1 >= AUDIT_GAP_REL : false;
  const overpaid = useGap ? useGap.ratio - 1 >= AUDIT_GAP_REL : false;
  const gapPct = useGap ? signedPct(locale, useGap.ratio - 1) : "";
  const gapAmount = useGap ? signedMoney(locale, useGap.gap) : "";

  const contracts = artist ? CONTRACTS.filter((c) => c.artistId === artist.id) : [];
  const today = todayOf(ctx);
  const audit = nextAuditWindow(contracts, today);

  /* Plateformes, titres, pays : parts du revenu du relevé. */
  const byDsp: Record<string, number> = {};
  for (const mo of Object.values(p.revenueByMonthDsp))
    for (const [d, v] of Object.entries(mo)) byDsp[d] = (byDsp[d] ?? 0) + (v ?? 0);
  const dspTotal = sumValues(byDsp) || total;
  const topDsp = topEntries(byDsp, 3);
  const knownDsp = topDsp.some(([d]) => d !== "other");
  const tracks = topEntries(p.trackRevenue, 3);
  const trackTotal = sumValues(p.trackRevenue) || total;
  const countries = topEntries(p.countryRevenue, 3);
  const countryTotal = sumValues(p.countryRevenue) || total;
  const title = (s: string) => t("statement.title", { title: s });

  const headline = useGap
    ? artistName
      ? t("statement.headlineGap", { format, artist: artistName, total: m(total), pct: gapPct })
      : t("statement.headlineGapNoArtist", { format, total: m(total), pct: gapPct })
    : artistName
      ? t("statement.headline", { format, artist: artistName, total: m(total), period })
      : t("statement.headlineNoArtist", { format, total: m(total), period });

  const figures: FeedAttachment["figures"] = [
    { label: t("statement.figures.received"), value: m(total) },
    { label: t("statement.figures.period"), value: period },
  ];
  if (useGap) figures.push({ label: t("statement.figures.gap"), value: t("statement.gapValue", { amount: gapAmount, pct: gapPct }) });
  else if (knownDsp) {
    const [d, v] = topDsp[0];
    figures.push({ label: t("statement.figures.topDsp"), value: t("statement.topDspValue", { dsp: t(`dsp.${d}`), pct: share(locale, v / dspTotal) }) });
  }
  if (p.totalStreams > 0) figures.push({ label: t("statement.figures.streams"), value: compact(locale, p.totalStreams) });

  /* Points, du plus utile au moins utile ; on en garde quatre. */
  const points: string[] = [];
  if (gap && !gap.comparable) points.push(t("statement.points.scale", { ratio: share(locale, gap.ratio) }));
  else if (useGap?.claim)
    points.push(
      t("statement.points.gapSource", {
        dsp: t(`dsp.${useGap.claim.dsp}`),
        amount: signedMoney(locale, -useGap.claim.shortfall),
        pct: signedPct(locale, useGap.claim.ratio),
      }),
    );
  else if (useGap?.uniformCut != null) points.push(t("statement.points.commission", { pct: share(locale, useGap.uniformCut) }));
  else if (useGap && overpaid) points.push(t("statement.points.gapOver", { pct: gapPct }));
  else if (useGap) points.push(t("statement.points.gapOk", { pct: gapPct }));
  if (!inEuros) points.push(t("statement.points.currency", { currency: p.currency }));
  if (multiArtist) points.push(t("statement.points.multiArtist", { count: p.artistNames.length }));
  if (tracks.length)
    points.push(t("statement.points.tracks", { list: list(locale, tracks.map(([s, v]) => t("statement.item", { name: title(s), value: share(locale, v / trackTotal) }))) }));
  if (knownDsp)
    points.push(t("statement.points.platforms", { list: list(locale, topDsp.map(([d, v]) => t("statement.item", { name: t(`dsp.${d}`), value: share(locale, v / dspTotal) }))) }));
  if (countries.length)
    points.push(t("statement.points.countries", { list: list(locale, countries.map(([c, v]) => t("statement.item", { name: countryName(locale, c), value: share(locale, v / countryTotal) }))) }));
  if (p.withheld > 0) points.push(t("statement.points.withheld", { amount: m(p.withheld) }));
  if (p.currency === "unknown" && !p.fx) points.push(t("statement.points.currencyUnknown"));
  points.push(t("statement.points.rows", { rows: p.rowCount, months: p.months.length }));

  /* Pour chaque service : ce qu'il a à faire, concrètement. */
  const forRoles: FeedAttachment["forRoles"] = {};
  const contract = contracts.find((c) => c.endDate >= today) ?? contracts[0] ?? null;
  const claim = useGap?.claim ?? null;
  if (claim) {
    const values = { amount: money(locale, claim.shortfall), dsp: t(`dsp.${claim.dsp}`) };
    forRoles.finance = audit?.dueDate
      ? t("statement.roles.financeClaimBy", { ...values, date: date(locale, audit.dueDate) })
      : t("statement.roles.financeClaim", values);
  } else if (contract && artistName && inEuros) {
    const values = { artist: artistName, rate: share(locale, contract.royaltyRate / 100), amount: m((total * contract.royaltyRate) / 100) };
    const remaining = remainingAdvance(contract);
    forRoles.finance =
      remaining > 0
        ? t("statement.roles.financeShareRecouping", { ...values, remaining: money(locale, remaining) })
        : t("statement.roles.financeShare", values);
  } else {
    forRoles.finance = t(useGap ? "statement.roles.financeCheck" : "statement.roles.financeNoExpected", { total: m(total), format });
  }

  if (tracks.length) {
    const [first, v] = tracks[0];
    const values = { title: first, pct: share(locale, v / trackTotal) };
    forRoles.da = claim
      ? t("statement.roles.daGap", { ...values, dsp: t(`dsp.${claim.dsp}`) })
      : tracks[1]
        ? t("statement.roles.da", { ...values, next: title(tracks[1][0]) })
        : t("statement.roles.daSingle", values);
  } else if (claim) forRoles.da = t("statement.roles.daGapOnly", { dsp: t(`dsp.${claim.dsp}`) });

  if (claim && audit?.dueDate) forRoles.juridique = t("statement.roles.juridiqueAudit", { date: date(locale, audit.dueDate), amount: money(locale, claim.shortfall) });
  else if (p.withheld > 0) forRoles.juridique = t("statement.roles.juridiqueWithheld", { amount: m(p.withheld) });

  if (useGap && shortfall) forRoles.direction = t("statement.roles.directionGap", { pct: gapPct, period, amount: gapAmount });
  else if (claim) forRoles.direction = t("statement.roles.directionClaim", { pct: gapPct, dsp: t(`dsp.${claim.dsp}`), amount: money(locale, claim.shortfall) });
  else if (useGap && overpaid) forRoles.direction = t("statement.roles.directionOver", { pct: gapPct, period });
  else if (useGap) forRoles.direction = t("statement.roles.directionOk", { total: m(total), period, pct: gapPct });
  else if (knownDsp)
    forRoles.direction = t("statement.roles.direction", { total: m(total), period, dsp: t(`dsp.${topDsp[0][0]}`), pct: share(locale, topDsp[0][1] / dspTotal) });

  forRoles.presidence = useGap
    ? t("statement.roles.presidenceGap", { total: m(total), period, pct: gapPct })
    : t("statement.roles.presidence", { total: m(total), period });

  return { ...base(name, "statement", ctx), headline, figures: figures.slice(0, 4), points: points.slice(0, 4), forRoles };
}

/* ─────────── Tableau ─────────── */

/** « 1 234,56 », « 1,234.56 », « 12 400 € », « (300) » → nombre ; null si ce n'est pas un nombre. */
export function looseNumber(raw: string): number | null {
  let s = raw.trim().replace(/[\s  ]/g, "").replace(/[€$£]|EUR|USD|GBP/gi, "");
  if (!s || s.endsWith("%")) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^[-+]?\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^[-+]?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Colonnes qui ressemblent à des nombres mais qu'on n'additionne pas. */
const NOT_SUMMABLE = /ann[ée]e|year|^id$|code|isrc|upc|ean|^n°|num[ée]ro|^no\.?$|^#$|t[ée]l|phone|siret|siren|iban|postal|zip|taux|rate|%|mois|month|date|semaine|week/i;
const MONEY_COL = /€|eur|montant|amount|revenu|revenue|earn|royalt|prix|price|co[uû]t|cost|^ca$|chiffre|budget|net|brut|gross|pay[ée]|paid|solde|balance|avance|advance|d[ée]pense|spend/i;
const TOTAL_ROW = /^(grand\s+)?total|^somme|^sum$/i;
const SUBTOTAL_ROW = /^sous[-\s]?total|^subtotal/i;

type Column = { index: number; header: string; total: number; currency: Currency | null };

export function sheetAttachment(name: string, rows: string[][], ctx: AttachmentCtx): AttachmentResult {
  const { t, locale } = ctx;
  const width = Math.max(...rows.map((r) => r.length));
  const header = Array.from({ length: width }, (_, i) => rows[0][i] || t("sheet.column", { n: i + 1 }));
  const firstText = (r: string[]) => r.find((c) => c !== "" && looseNumber(c) === null) ?? "";
  const all = rows.slice(1);
  const isTotal = (r: string[]) => TOTAL_ROW.test(firstText(r)) || SUBTOTAL_ROW.test(firstText(r));
  const data = all.filter((r) => !isTotal(r));
  const grand = [...all].reverse().find((r) => TOTAL_ROW.test(firstText(r))) ?? null;
  if (!data.length) return { error: t("errors.empty") };

  const numeric: Column[] = [];
  const textCols: number[] = [];
  for (let i = 0; i < width; i++) {
    const cells = data.map((r) => r[i] ?? "").filter((c) => c !== "");
    if (!cells.length) continue;
    const nums = cells.map(looseNumber).filter((n): n is number => n !== null);
    const h = header[i];
    const yearLike = nums.length === cells.length && nums.every((n) => Number.isInteger(n) && n >= 1900 && n <= 2100);
    if (nums.length / cells.length >= 0.8 && !NOT_SUMMABLE.test(h) && !yearLike) {
      const currency: Currency | null = /\$|usd/i.test(h + cells.join(""))
        ? "USD"
        : /£|gbp/i.test(h + cells.join(""))
          ? "GBP"
          : MONEY_COL.test(h) || cells.some((c) => c.includes("€"))
            ? "EUR"
            : null;
      numeric.push({ index: i, header: h, total: nums.reduce((a, b) => a + b, 0), currency });
    } else if (nums.length / cells.length < 0.5) textCols.push(i);
  }
  const fmt = (c: Column, n: number) => (c.currency ? money(locale, n, c.currency) : plainNumber(locale, n));
  // Colonne principale : la première colonne d'argent, sinon le plus gros total.
  const main = numeric.find((c) => c.currency) ?? [...numeric].sort((a, b) => Math.abs(b.total) - Math.abs(a.total))[0] ?? null;
  const labelCol = textCols[0] ?? null;
  const labelOf = (r: string[], i: number) => (labelCol !== null && r[labelCol] ? r[labelCol] : t("sheet.row", { n: i + 1 }));

  const rowsCount = data.length;
  const figures: FeedAttachment["figures"] = [
    { label: t("sheet.figures.rows"), value: plainNumber(locale, rowsCount) },
    { label: t("sheet.figures.cols"), value: plainNumber(locale, width) },
  ];
  const totals = main ? [main, ...numeric.filter((c) => c !== main)].slice(0, 2) : [];
  for (const c of totals) figures.push({ label: t("sheet.figures.total", { column: c.header }), value: fmt(c, c.total) });

  const points: string[] = [];
  const forRoles: FeedAttachment["forRoles"] = {};
  /* La ligne « Total » du fichier contre la somme des lignes : le contrôle qu'un non-financier ne fait pas. */
  const stated = main && grand ? looseNumber(grand[main.index] ?? "") : null;
  const mismatch = main && stated !== null && Math.abs(stated - main.total) >= 0.5 ? stated - main.total : null;
  const grandLabel = grand ? firstText(grand) : "";

  if (main && mismatch !== null) {
    points.push(t("sheet.points.totalMismatch", { label: grandLabel, stated: fmt(main, stated!), column: main.header, computed: fmt(main, main.total), diff: fmt(main, Math.abs(mismatch)) }));
  }
  let top: Array<{ label: string; value: number }> = [];
  if (main) {
    top = data
      .map((r, i) => ({ label: labelOf(r, i), value: looseNumber(r[main.index] ?? "") ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    if (top.length)
      points.push(t("sheet.points.top", { column: main.header, list: list(locale, top.map((x) => t("sheet.item", { name: x.label, value: fmt(main, x.value) }))) }));
    const shown = numeric.slice(0, 3).map((c) => t("sheet.item", { name: c.header, value: fmt(c, c.total) }));
    if (numeric.length > 3) shown.push(t("sheet.others", { count: numeric.length - 3 }));
    points.push(t("sheet.points.numeric", { list: list(locale, shown) }));
  } else {
    points.push(t("sheet.points.noNumeric"));
    const first = data.slice(0, 3).map((r, i) => labelOf(r, i));
    if (labelCol !== null) points.push(t("sheet.points.first", { list: list(locale, first) }));
  }
  if (grand && mismatch === null) points.push(t("sheet.points.totalRow", { label: grandLabel }));
  const headers = header.slice(0, 5);
  if (width > 5) headers.push(t("sheet.others", { count: width - 5 }));
  points.push(t("sheet.points.columns", { list: list(locale, headers) }));

  if (main) {
    const totalLabel = fmt(main, main.total);
    forRoles.finance =
      mismatch !== null
        ? t("sheet.roles.financeMismatch", { label: grandLabel, diff: fmt(main, Math.abs(mismatch)), column: main.header })
        : t("sheet.roles.finance", { column: main.header, total: totalLabel, rows: rowsCount });
    if (top.length && main.total > 0) {
      const pct = share(locale, top[0].value / main.total);
      forRoles.da = t("sheet.roles.da", { label: top[0].label, pct, column: main.header });
      forRoles.direction = t("sheet.roles.direction", { total: totalLabel, column: main.header, rows: rowsCount, label: top[0].label, pct });
      forRoles.presidence = t("sheet.roles.presidence", { total: totalLabel, column: main.header, label: top[0].label });
    } else {
      forRoles.direction = t("sheet.roles.directionTotal", { total: totalLabel, column: main.header, rows: rowsCount });
    }
  } else {
    forRoles.direction = t("sheet.roles.directionPlain", { rows: rowsCount });
  }

  const headline = main
    ? t("sheet.headline", { name, rows: rowsCount, total: fmt(main, main.total), column: main.header })
    : t("sheet.headlinePlain", { name, rows: rowsCount, cols: width });

  return { ...base(name, "sheet", ctx), headline, figures: figures.slice(0, 4), points: points.slice(0, 4), forRoles };
}

/* ─────────── Contrat ─────────── */

const TYPE_KEY: Record<Contract["type"], string> = {
  licence: "licence",
  distribution: "distribution",
  "édition": "edition",
  management: "management",
  booking: "booking",
};
const SEVERITY: Record<ContractAlert["severity"], number> = { danger: 0, warning: 1, info: 2 };
/** Contreparties génériques de data.ts (« Label » = la maison, « Distro » = un distributeur) : traduites. */
const GENERIC_COUNTERPARTY: Record<string, string> = { Label: "label", Distro: "distributor" };
/** « Option de … » → « option de … » au milieu d'une phrase (pas « FY2025 » ni « ISRC »). */
const midSentence = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLocaleLowerCase() + s.slice(1) : s);

/**
 * Le contrat de l'artiste (le plus lourd s'il y en a plusieurs) en langage clair pour un
 * non-juriste : ce que dit le taux, où en est l'avance, la prochaine échéance, le point de
 * vigilance — et ce que chaque service en fait. `{ error }` si l'artiste n'a pas de contrat.
 */
export function translateContract(artistId: string | null | undefined, ctx: AttachmentCtx): AttachmentResult {
  const { t, locale } = ctx;
  const artist = rosterArtist(artistId);
  if (!artistId) return { error: t("errors.noArtist") };
  const artistName = artist?.name ?? ctx.artistName ?? artistId;
  const contracts = CONTRACTS.filter((c) => c.artistId === artistId);
  if (!artist || !contracts.length) return { error: t("errors.noContract", { artist: artistName }) };
  const today = todayOf(ctx);
  const c = [...contracts].sort((a, b) => Number(b.endDate >= today) - Number(a.endDate >= today) || b.advance - a.advance)[0];

  const type = t(`contract.types.${TYPE_KEY[c.type]}`);
  const rate = share(locale, c.royaltyRate / 100);
  const fee = share(locale, (100 - c.royaltyRate) / 100);
  const end = date(locale, c.endDate);
  const remaining = remainingAdvance(c);
  const recouped = Math.max(0, c.advance - remaining);
  const pct = share(locale, c.advance ? recouped / c.advance : 1);
  const lang = locale.startsWith("en") ? "en" : "fr";
  const upcoming = c.alerts
    .filter((a) => a.dueDate && a.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const next = upcoming[0] ?? null;
  const nextDate = next?.dueDate ?? c.endDate;
  const kindLabel = (a: ContractAlert) => t(`contract.kinds.${a.kind}`);
  const risk = [...c.alerts].sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
  const generic = GENERIC_COUNTERPARTY[c.counterparty];
  const counterparty = generic ? t(`contract.counterparty.${generic}`) : c.counterparty;
  const values = { artist: artistName, counterparty, rate, fee, end, type };

  const headline = t("contract.headline", values);
  const figures: FeedAttachment["figures"] = [
    { label: t("contract.figures.advance"), value: c.advance ? money(locale, c.advance) : t("contract.noAdvance") },
    { label: t("contract.figures.rate"), value: rate },
    { label: t("contract.figures.remaining"), value: money(locale, remaining) },
    { label: t("contract.figures.next"), value: date(locale, nextDate) },
  ];

  const rateKey = c.type === "licence" ? "rateLicence" : c.type === "distribution" ? "rateDistribution" : c.type === "édition" ? "rateEdition" : "rateOther";
  const points = [
    t(`contract.points.${rateKey}`, values),
    c.advance === 0
      ? t("contract.points.noAdvance")
      : remaining === 0
        ? t("contract.points.recouped", { advance: money(locale, c.advance) })
        : t("contract.points.recouping", { advance: money(locale, c.advance), recouped: money(locale, recouped), pct, remaining: money(locale, remaining), artist: artistName }),
    next ? t("contract.points.next", { date: date(locale, nextDate), what: kindLabel(next) }) : t("contract.points.nextEnd", { date: end }),
    risk && risk.severity !== "info"
      ? t("contract.points.risk", { what: midSentence(risk.message[lang]) })
      : remaining > 0
        ? t("contract.points.riskRecoup", { remaining: money(locale, remaining), date: end })
        : risk
          ? t("contract.points.risk", { what: midSentence(risk.message[lang]) })
          : t("contract.points.noRisk"),
  ];

  const forRoles: FeedAttachment["forRoles"] = {};
  const legal = c.alerts.find((a) => a.kind === "unusual-clause") ?? next;
  if (!legal) forRoles.juridique = t("contract.roles.juridiqueNone", { end });
  else if (legal.kind === "unusual-clause") forRoles.juridique = t("contract.roles.juridiqueClause", { what: midSentence(legal.message[lang]) });
  else {
    const key = { option: "juridiqueOption", expiry: "juridiqueExpiry", "audit-window": "juridiqueAudit" }[legal.kind];
    forRoles.juridique = t(`contract.roles.${key}`, { date: date(locale, legal.dueDate ?? c.endDate), end });
  }
  forRoles.finance =
    c.advance === 0
      ? t("contract.roles.financeNoAdvance", values)
      : remaining > 0
        ? t("contract.roles.financeRecouping", { ...values, remaining: money(locale, remaining) })
        : t("contract.roles.financeRecouped", values);
  /* Le DA : ce qui engage la suite artistique (option, fin de contrat), pas la fenêtre d'audit. */
  const career = upcoming.find((a) => a.kind === "option" || a.kind === "expiry") ?? null;
  forRoles.da = career?.dueDate
    ? t("contract.roles.daNext", { artist: artistName, what: kindLabel(career), date: date(locale, career.dueDate) })
    : t("contract.roles.daEnd", { artist: artistName, end });
  forRoles.direction =
    remaining > 0
      ? t("contract.roles.directionExposed", { artist: artistName, remaining: money(locale, remaining), pct, date: date(locale, nextDate) })
      : t("contract.roles.directionClear", { artist: artistName, date: date(locale, nextDate) });
  const status = c.advance === 0 ? t("contract.roles.statusNone") : remaining === 0 ? t("contract.roles.statusRecouped") : t("contract.roles.statusRecouping", { pct });
  forRoles.presidence = t("contract.roles.presidence", { ...values, status });

  return { ...base(`${t("contract.fileName", { artist: artistName })}`, "contract", ctx), headline, figures, points, forRoles };
}
