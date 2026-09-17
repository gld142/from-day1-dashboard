/**
 * Régénère src/lib/real/snapshots/index.ts à partir des fichiers présents :
 * un dossier par artiste (relevés quotidiens) + le dossier `market` (Top 200
 * France). Partagé par scripts/snapshot.mjs et scripts/snapshot-market.mjs.
 */
import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SNAP_DIR = join(ROOT, "src/lib/real/snapshots");
/** Sous-dossier des relevés marché : pas un artiste. */
export const MARKET_DIR_NAME = "market";

export const isSnapFile = (f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f);

async function datesIn(dir) {
  try {
    return (await readdir(dir)).filter(isSnapFile).map((f) => f.slice(0, 10)).sort();
  } catch {
    return [];
  }
}

export async function writeIndex() {
  const dirs = (await readdir(SNAP_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name !== MARKET_DIR_NAME)
    .map((d) => d.name)
    .sort();
  const imports = [];
  const entries = [];
  let latest = "";
  for (const id of dirs) {
    const dates = await datesIn(join(SNAP_DIR, id));
    if (!dates.length) continue;
    const names = [];
    for (const d of dates) {
      const ident = `${id}_${d}`.replace(/[^A-Za-z0-9_]/g, "_");
      imports.push(`import ${ident} from "./${id}/${d}.json";`);
      names.push(ident);
      if (d > latest) latest = d;
    }
    entries.push(`  "${id}": [${names.join(", ")}] as Snapshot[],`);
  }

  // Relevés marché (Top 200 France) : un fichier par date, indexés par date.
  const marketDates = await datesIn(join(SNAP_DIR, MARKET_DIR_NAME));
  const marketImports = [];
  const marketEntries = [];
  for (const d of marketDates) {
    const ident = `market_${d}`.replace(/[^A-Za-z0-9_]/g, "_");
    marketImports.push(`import ${ident} from "./${MARKET_DIR_NAME}/${d}.json";`);
    marketEntries.push(`  "${d}": ${ident} as MarketSnapshot,`);
  }

  const src = [
    "/* Généré par scripts/snapshot.mjs — ne pas éditer à la main. */",
    'import type { MarketSnapshot, Snapshot } from "../types";',
    ...imports,
    ...marketImports,
    "",
    "/** Relevés par artiste, triés par date croissante. */",
    "export const SNAPSHOTS: Record<string, Snapshot[]> = {",
    ...entries,
    "};",
    "",
    `export const LATEST_DATE = "${latest}";`,
    "",
    "/** Relevés du Top 200 Spotify France, par date de relevé. */",
    "export const MARKET: Record<string, MarketSnapshot> = {",
    ...marketEntries,
    "};",
    "",
    "/** Dates des relevés marché, croissantes. */",
    `export const MARKET_DATES: string[] = [${marketDates.map((d) => `"${d}"`).join(", ")}];`,
    "",
  ].join("\n");
  await writeFile(join(SNAP_DIR, "index.ts"), src);
  return join(SNAP_DIR, "index.ts");
}
