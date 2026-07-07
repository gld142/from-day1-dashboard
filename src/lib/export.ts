/**
 * Exports "comptable-ready" : CSV compatible Excel FR (BOM UTF-8,
 * séparateur point-virgule, décimales à virgule) + rapport imprimable.
 * Aucune dépendance UI — utilisable depuis n'importe quelle page.
 */

export type CsvColumn<T> = {
  /** En-tête de colonne, déjà localisé par l'appelant (via next-intl). */
  header: string;
  /** Valeur brute de la cellule pour une ligne donnée. */
  cell: (row: T) => string | number | null | undefined;
};

/** Séparateur attendu par Excel en locale FR. */
const SEPARATOR = ";";
/** BOM UTF-8 : force Excel à décoder le fichier en UTF-8 (accents). */
const BOM = "\uFEFF";
/** Fin de ligne CRLF — convention RFC 4180, la plus sûre pour Excel. */
const EOL = "\r\n";

/** Arrondit un montant à 2 décimales (centimes). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sérialise une valeur de cellule :
 * - null/undefined → chaîne vide ;
 * - nombre → décimales à virgule (convention Excel FR) ;
 * - échappement RFC 4180 (guillemets doublés) si la valeur contient
 *   le séparateur, un guillemet, un retour ligne ou des espaces de bord.
 */
export function escapeCsvValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "number" ? String(value).replace(".", ",") : String(value);
  const needsQuoting =
    s.includes(SEPARATOR) ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r") ||
    s !== s.trim();
  return needsQuoting ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Construit le contenu CSV complet (BOM + en-têtes + lignes). */
export function toCsv<T>(
  rows: readonly T[],
  columns: ReadonlyArray<CsvColumn<T>>,
): string {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(SEPARATOR);
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.cell(row))).join(SEPARATOR),
  );
  return BOM + [header, ...body].join(EOL) + EOL;
}

/**
 * Déclenche le téléchargement d'un fichier CSV réel
 * (Blob + URL.createObjectURL + ancre éphémère).
 */
export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: ReadonlyArray<CsvColumn<T>>,
): void {
  if (typeof document === "undefined") return;
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith(".csv")
    ? filename
    : `${filename}.csv`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Révocation différée : laisse le navigateur démarrer le téléchargement.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Ouvre le dialogue d'impression du navigateur — combiné aux styles
 * print injectés par <PrintStyles/>, produit un rapport PDF propre.
 */
export function printReport(): void {
  if (typeof window === "undefined") return;
  window.print();
}
