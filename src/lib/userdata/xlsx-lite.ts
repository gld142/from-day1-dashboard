/**
 * Lecteur .xlsx minimal, sans dépendance : un .xlsx est une archive zip de fichiers XML.
 * Lit le répertoire central de l'archive, décompresse avec `DecompressionStream("deflate-raw")`
 * (navigateur, Node 18+), puis `xl/sharedStrings.xml`, `xl/styles.xml` (pour reconnaître les
 * dates) et la première feuille VISIBLE de `xl/workbook.xml` (à défaut `xl/worksheets/sheet1.xml`).
 * Le XML est lu sans DOM (expressions régulières bornées) : le module tourne dans vitest (node).
 *
 * Limites assumées : pas de zip64, pas de chiffrement, pas de formules recalculées (on lit la
 * valeur mise en cache par Excel), une seule feuille. Les erreurs sont des `XlsxError` au code
 * stable (l'appelant traduit le message).
 */

export type XlsxErrorCode = "NOT_ZIP" | "ZIP64" | "ENCRYPTED" | "NO_SHEET" | "TOO_LARGE" | "BAD_ENTRY";

export class XlsxError extends Error {
  constructor(readonly code: XlsxErrorCode) {
    super(code);
    this.name = "XlsxError";
  }
}

/** Plafond de décompression d'UNE entrée (une archive de 5 Mo peut cacher une bombe). */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/* ─────────── Zip : répertoire central ─────────── */

type ZipEntry = { name: string; method: number; compressedSize: number; size: number; offset: number; flags: number };

function u16(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8);
}
function u32(b: Uint8Array, i: number) {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** Vrai si les octets commencent par l'en-tête local d'un zip (« PK\x03\x04 »). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function readCentralDirectory(b: Uint8Array): Map<string, ZipEntry> {
  // Fin du répertoire central : 22 octets + un commentaire de 65 535 octets au plus.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError("NOT_ZIP");
  const count = u16(b, eocd + 10);
  const cdOffset = u32(b, eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new XlsxError("ZIP64");

  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder("utf-8");
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw new XlsxError("NOT_ZIP");
    const flags = u16(b, p + 8);
    const method = u16(b, p + 10);
    const compressedSize = u32(b, p + 20);
    const size = u32(b, p + 24);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const offset = u32(b, p + 42);
    if (compressedSize === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) throw new XlsxError("ZIP64");
    const name = decoder.decode(b.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, "/");
    entries.set(name.replace(/^\//, ""), { name, method, compressedSize, size, offset, flags });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ENTRY_BYTES) {
      await reader.cancel();
      throw new XlsxError("TOO_LARGE");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

async function readEntry(b: Uint8Array, e: ZipEntry): Promise<string> {
  if (e.flags & 0x1) throw new XlsxError("ENCRYPTED");
  if (e.size > MAX_ENTRY_BYTES) throw new XlsxError("TOO_LARGE");
  const h = e.offset;
  if (h + 30 > b.length || u32(b, h) !== 0x04034b50) throw new XlsxError("BAD_ENTRY");
  // Tailles du répertoire central (l'en-tête local peut les remettre à zéro : bit 3).
  const start = h + 30 + u16(b, h + 26) + u16(b, h + 28);
  const raw = b.subarray(start, start + e.compressedSize);
  let bytes: Uint8Array;
  if (e.method === 0) bytes = raw;
  else if (e.method === 8) bytes = await inflateRaw(raw);
  else throw new XlsxError("BAD_ENTRY");
  return new TextDecoder("utf-8").decode(bytes);
}

/* ─────────── XML sans DOM ─────────── */

/** Balise `name`, préfixe d'espace de noms facultatif (`<x:row>` des fichiers OpenXML SDK). */
const P = "(?:[A-Za-z_][\\w.-]*:)?";

/** Éléments `<name …>…</name>` ou `<name …/>` : attributs bruts et contenu. */
function elements(xml: string, name: string): Array<{ attrs: string; body: string }> {
  const re = new RegExp(`<${P}${name}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${P}${name}\\s*>)`, "g");
  const out: Array<{ attrs: string; body: string }> = [];
  for (const m of xml.matchAll(re)) out.push({ attrs: m[1] ?? "", body: m[2] ?? "" });
  return out;
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${P}${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return m ? decodeXml(m[1] ?? m[2] ?? "") : null;
}

/** Entités XML, puis les échappements OOXML `_x000D_` (caractère par son code hexadécimal). */
function decodeXml(s: string): string {
  return s
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e];
    })
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Texte d'une chaîne riche (`<t>`, runs `<r><t>`), sans la phonétique (`<rPh>`). */
function richText(body: string): string {
  const clean = body.replace(new RegExp(`<${P}rPh\\b[\\s\\S]*?<\\/${P}rPh\\s*>`, "g"), "");
  return elements(clean, "t")
    .map((t) => decodeXml(t.body))
    .join("");
}

/* ─────────── Dates : styles.xml ─────────── */

/** Formats intégrés d'Excel qui sont des dates ou des heures (ECMA-376, §18.8.30). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function isDateFormatCode(code: string): boolean {
  // Sans le texte entre guillemets, les échappements et les [couleurs] / [$-locale].
  const bare = code.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
  return /[dmyhs]/i.test(bare) && !/^[#0.,\s%E+-]*$/i.test(bare);
}

/** Index de style (`s` d'une cellule) → vrai si la cellule est une date. */
function dateStyles(stylesXml: string | null): Set<number> {
  const out = new Set<number>();
  if (!stylesXml) return out;
  const custom = new Map<number, string>();
  for (const f of elements(stylesXml, "numFmt")) {
    const id = Number(attr(f.attrs, "numFmtId"));
    const code = attr(f.attrs, "formatCode");
    if (Number.isFinite(id) && code !== null) custom.set(id, code);
  }
  const cellXfs = elements(stylesXml, "cellXfs")[0];
  if (!cellXfs) return out;
  elements(cellXfs.body, "xf").forEach((xf, i) => {
    const id = Number(attr(xf.attrs, "numFmtId") ?? "0");
    const code = custom.get(id);
    if (code !== undefined ? isDateFormatCode(code) : BUILTIN_DATE_FORMATS.has(id)) out.add(i);
  });
  return out;
}

/** Numéro de série Excel → « AAAA-MM-JJ » (heure ignorée). Système 1900 ou 1904. */
export function excelSerialToIso(serial: number, date1904 = false): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  // Excel croit au 29/02/1900 : à partir du 01/03/1900, l'origine 30/12/1899 tombe juste.
  const ms = Date.UTC(1899, 11, 30) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/* ─────────── Feuille ─────────── */

/** « C5 » → 2 (colonnes comptées à partir de 0) ; null sans lettres. */
function columnIndex(ref: string | null): number | null {
  const m = ref?.match(/^\$?([A-Za-z]{1,3})/);
  if (!m) return null;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function rowIndex(ref: string | null): number | null {
  const m = ref?.match(/(\d+)$/);
  return m ? Number(m[1]) - 1 : null;
}

/** Nombre tel qu'Excel l'affiche (15 chiffres significatifs) : « 45.69 », pas « 45.689999999999998 ». */
function formatNumber(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw.trim();
  return String(Number(n.toPrecision(15)));
}

function parseSheet(xml: string, shared: string[], dates: Set<number>, date1904: boolean): string[][] {
  const rows: string[][] = [];
  const data = elements(xml, "sheetData")[0];
  if (!data) return rows;
  let nextRow = 0;
  for (const row of elements(data.body, "row")) {
    const r = rowIndex(attr(row.attrs, "r")) ?? nextRow;
    nextRow = r + 1;
    const cells: string[] = [];
    let nextCol = 0;
    for (const c of elements(row.body, "c")) {
      const col = columnIndex(attr(c.attrs, "r")) ?? nextCol;
      nextCol = col + 1;
      const type = attr(c.attrs, "t");
      const style = Number(attr(c.attrs, "s") ?? "0");
      const v = elements(c.body, "v")[0];
      const raw = v ? decodeXml(v.body) : "";
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = richText(elements(c.body, "is")[0]?.body ?? "");
      else if (type === "str" || type === "e") value = raw;
      else if (type === "b") value = raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
      else if (type === "d") value = raw.slice(0, 10);
      else if (raw !== "") value = dates.has(style) && Number.isFinite(Number(raw)) ? excelSerialToIso(Number(raw), date1904) : formatNumber(raw);
      if (value === "") continue;
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    while (rows.length < r) rows.push([]);
    rows[r] = cells;
  }
  return rows;
}

/* ─────────── Classeur ─────────── */

/** Chemin de la première feuille visible, d'après workbook.xml et ses relations. */
function firstSheetPath(workbook: string | null, rels: string | null): string | null {
  if (!workbook) return null;
  const sheets = elements(workbook, "sheet");
  const sheet = sheets.find((s) => (attr(s.attrs, "state") ?? "visible") === "visible") ?? sheets[0];
  const rid = sheet ? attr(sheet.attrs, "id") : null;
  if (!rid || !rels) return null;
  const rel = elements(rels, "Relationship").find((r) => attr(r.attrs, "Id") === rid);
  const target = rel ? attr(rel.attrs, "Target") : null;
  if (!target) return null;
  if (target.startsWith("/")) return target.slice(1);
  // Relatif au dossier de workbook.xml (« xl/ »), « ../ » compris.
  const parts = ["xl", ...target.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

/**
 * Lit la première feuille d'un .xlsx : une ligne par ligne Excel (les lignes vides restent des
 * tableaux vides, à leur place), une case par colonne jusqu'à la dernière cellule remplie (les
 * cases vides intermédiaires valent ""). Dates (style de date) en « AAAA-MM-JJ », nombres tels
 * qu'Excel les affiche sans format, booléens « TRUE » / « FALSE ».
 */
export async function readXlsx(input: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!looksLikeZip(b)) throw new XlsxError("NOT_ZIP");
  const entries = readCentralDirectory(b);
  const text = async (path: string) => {
    const e = entries.get(path);
    return e ? readEntry(b, e) : null;
  };

  const workbook = await text("xl/workbook.xml");
  const path =
    [firstSheetPath(workbook, await text("xl/_rels/workbook.xml.rels")), "xl/worksheets/sheet1.xml"].find(
      (p): p is string => !!p && entries.has(p),
    ) ?? [...entries.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  if (!path) throw new XlsxError("NO_SHEET");

  const sharedXml = await text("xl/sharedStrings.xml");
  const shared = sharedXml ? elements(sharedXml, "si").map((si) => richText(si.body)) : [];
  const date1904 = workbook ? /date1904\s*=\s*["'](1|true)["']/i.test(workbook) : false;
  const sheet = await text(path);
  if (sheet === null) throw new XlsxError("NO_SHEET");
  return parseSheet(sheet, shared, dateStyles(await text("xl/styles.xml")), date1904);
}

/* ─────────── CSV ─────────── */

/** Lignes → CSV (virgule, guillemets doublés quand une case contient , " ou un retour à la ligne). */
export function rowsToCsv(rows: readonly (readonly string[])[]): string {
  const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
