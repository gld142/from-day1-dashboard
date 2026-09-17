#!/usr/bin/env node
/**
 * Relevé quotidien du marché : Top 200 Spotify France (Kworb) + mentions
 * ℗ / © de chaque titre (page Spotify publique) → groupe (major / grand indé)
 * et genre (table manuelle). Écrit src/lib/real/snapshots/market/<date>.json
 * puis régénère l'index des relevés.
 *
 * Sources, mesurées le 17/09/2026 :
 *  - https://kworb.net/spotify/country/fr_daily.html : 200 lignes
 *    « Pos, P+, Artist and Title, Days, Pk, (x?), Streams, Streams+, 7Day,
 *    7Day+, Total », chaque titre lié à ../track/<id Spotify>.html. Le titre
 *    de la page porte la date du classement (J-2 en général : « 2026/09/15 »
 *    le 17/09), conservée dans `chartDate`.
 *  - https://open.spotify.com/track/<id> : servie rendue à un UA non
 *    navigateur, sans en-tête accept-language (sinon redirection intl-fr,
 *    équivalente mais une requête de plus). Les lignes « © … » / « ℗ … »
 *    sont dans des <p> en pied de page.
 *
 * Volume : une requête Kworb + une requête Spotify par titre inconnu du cache
 * src/lib/real/market/labels.json (1 requête / s, 30 s de délai max) : ~4 min
 * la première fois, quelques secondes ensuite. Un échec Spotify laisse le
 * titre en « unknown » (estimé) et n'interrompt jamais le relevé.
 *
 * Usage : npm run snapshot:market            (date du jour, heure de Paris)
 *         npm run snapshot:market -- 2026-09-16
 *         npm run snapshot:market -- --force  (écrase un relevé déjà présent)
 * Appelé aussi en fin de scripts/snapshot.mjs.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyLabel } from "../src/lib/real/market/groups.ts";
import { MARKET_DIR_NAME, ROOT, SNAP_DIR, writeIndex } from "./snapshot-index.mjs";

const KWORB_URL = "https://kworb.net/spotify/country/fr_daily.html";
const SOURCE = "kworb.net/spotify/country/fr_daily";
const MARKET_DIR = join(SNAP_DIR, MARKET_DIR_NAME);
const LABELS_FILE = join(ROOT, "src/lib/real/market/labels.json");
const GENRES_FILE = join(ROOT, "src/lib/real/market/genres.json");
/** UA navigateur pour Kworb. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
/** UA « non navigateur » : open.spotify.com sert alors la page rendue (cf. scripts/snapshot.mjs). */
const UA_PLAIN = "from-day1-snapshot/1.0";
const SPOTIFY_INTERVAL_MS = 1000;
const TIMEOUT_MS = 30_000;

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
const force = process.argv.includes("--force");
const date = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? parisToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Date invalide : ${date} (attendu YYYY-MM-DD)`);
  process.exit(1);
}

const warn = (msg) => console.warn(`⚠ ${msg}`);
/** "286,503" → 286503 ; "" → null. */
const num = (s) => {
  const digits = String(s).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
};
/** "+9,707" → 9707, "-1,025" → -1025, "" → null. */
const signed = (s) => {
  const t = String(s).trim();
  const n = num(t);
  return n === null ? null : t.startsWith("-") ? -n : n;
};
/** P+ : "=" → 0, "+3" → 3, "-2" → -2, "NEW" / "RE" → null (entrée ou retour). */
const rankDelta = (s) => {
  const t = String(s).trim();
  if (t === "=") return 0;
  return /^[+-]\d+$/.test(t) ? Number(t) : null;
};
const unescapeHtml = (s) =>
  String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
const clean = (s) => unescapeHtml(s).replace(/\s+/g, " ").trim();

async function text(url, userAgent) {
  const res = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/* ── Kworb : Top 200 du jour ── */
async function kworbTop200() {
  const html = await text(KWORB_URL, UA);
  const chartDate = html.match(/Spotify Daily Chart - France - (\d{4})\/(\d{2})\/(\d{2})/);
  const rows = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 11) continue;
    const trackId = cells[2].match(/track\/([A-Za-z0-9]{22})\.html/)?.[1];
    if (!trackId) continue;
    const artists = [...cells[2].matchAll(/artist\/([A-Za-z0-9]+)\.html"[^>]*>([^<]*)</g)];
    const title = cells[2].match(/track\/[A-Za-z0-9]{22}\.html"[^>]*>([^<]*)</)?.[1] ?? "";
    // Repli sans lien artiste : « Artiste - Titre » en texte brut, coupé au premier « - ».
    const plain = clean(cells[2].replace(/<[^>]+>/g, ""));
    const artist = artists[0] ? clean(artists[0][2]) : plain.split(" - ")[0];
    rows.push({
      rank: Number(cells[0].replace(/<[^>]+>/g, "").trim()),
      delta: rankDelta(cells[1].replace(/<[^>]+>/g, "")),
      trackId,
      artistId: artists[0]?.[1] ?? null,
      artist,
      title: clean(title) || plain.split(" - ").slice(1).join(" - "),
      featuring: artists.slice(1).map((a) => clean(a[2])),
      days: num(cells[3]) ?? 0,
      peak: num(cells[4]) ?? 0,
      peakDays: num(cells[5]),
      streams: num(cells[6]) ?? 0,
      streamsDelta: signed(cells[7]),
      streams7d: num(cells[8]) ?? 0,
      streams7dDelta: signed(cells[9]),
      total: num(cells[10]) ?? 0,
    });
  }
  return { chartDate: chartDate ? `${chartDate[1]}-${chartDate[2]}-${chartDate[3]}` : null, rows };
}

/* ── Spotify : lignes ℗ / © d'un titre ── */
async function labelLines(trackId) {
  const html = await text(`https://open.spotify.com/track/${trackId}`, UA_PLAIN);
  const lines = [...html.matchAll(/>([©℗][^<]{3,200})</g)].map((m) => clean(m[1]));
  return [...new Set(lines)];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── main ── */
async function main() {
  const out = join(MARKET_DIR, `${date}.json`);
  if ((await exists(out)) && !force) {
    warn(`relevé marché du ${date} déjà présent (${out.slice(ROOT.length + 1)}) — rien écrit. Relancer avec --force pour écraser.`);
    process.exit(1);
  }
  const capturedAt = new Date().toISOString();
  console.log(`Relevé marché du ${date} — Top 200 Spotify France (Kworb)${force ? " — --force" : ""}`);

  const { chartDate, rows } = await kworbTop200();
  if (rows.length !== 200) warn(`kworb : ${rows.length} lignes lues (200 attendues)`);
  if (!chartDate) warn("kworb : date du classement introuvable dans le titre de la page");
  else console.log(`  classement daté du ${chartDate} (${rows.length} titres)`);

  const cache = JSON.parse(await readFile(LABELS_FILE, "utf8").catch(() => "{}"));
  const genres = JSON.parse(await readFile(GENRES_FILE, "utf8").catch(() => "{}"));
  const missing = rows.filter((r) => !cache[r.trackId]);
  console.log(`  labels : ${rows.length - missing.length} en cache, ${missing.length} à lire sur Spotify (≈ ${missing.length} s)`);

  let fetched = 0;
  let failed = 0;
  let last = 0;
  const persist = () => writeFile(LABELS_FILE, JSON.stringify(cache, null, 2) + "\n");
  for (const r of missing) {
    const wait = last + SPOTIFY_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const lines = await labelLines(r.trackId);
      if (!lines.length) {
        // Non mis en cache : le titre sera retenté demain (format de page changé ?).
        warn(`spotify ${r.trackId} (${r.artist} - ${r.title}) : aucune ligne ℗/© trouvée`);
        failed++;
        continue;
      }
      cache[r.trackId] = { track: `${r.artist} - ${r.title}`, lines, fetchedAt: new Date().toISOString() };
      fetched++;
      if (fetched % 25 === 0) {
        await persist();
        console.log(`  … ${fetched}/${missing.length}`);
      }
    } catch (e) {
      warn(`spotify ${r.trackId} (${r.artist} - ${r.title}) : ${e.message.split("\n")[0]}`);
      failed++;
    }
  }
  if (fetched) await persist();

  const tracks = rows.map((r) => {
    const lines = cache[r.trackId]?.lines ?? [];
    const label = { lines, ...classifyLabel(lines) };
    const genre = genres[r.artist.toLowerCase()] ?? "unknown";
    return { ...r, label, genre };
  });

  const snapshot = { date, capturedAt, chartDate, country: "FR", source: SOURCE, tracks };
  await mkdir(MARKET_DIR, { recursive: true });
  await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");

  // Résumé : parts par groupe (streams du jour), titres sans label, genres non renseignés.
  const total = tracks.reduce((s, t) => s + t.streams, 0) || 1;
  const byGroup = new Map();
  for (const t of tracks) byGroup.set(t.label.group, (byGroup.get(t.label.group) ?? 0) + t.streams);
  const shares = [...byGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g, s]) => `${g} ${((s / total) * 100).toFixed(1)} %`)
    .join(" · ");
  const unknownLabels = tracks.filter((t) => t.label.group === "unknown").length;
  const unknownGenres = new Set(tracks.filter((t) => t.genre === "unknown").map((t) => t.artist));
  console.log(`  labels lus : ${fetched} nouveaux, ${failed} échecs — ${unknownLabels} titre(s) sans label`);
  console.log(`  parts (streams du jour) : ${shares}`);
  if (unknownGenres.size) console.log(`  genres non renseignés (${unknownGenres.size}) : ${[...unknownGenres].join(", ")}`);
  console.log(`  écrit : ${out.slice(ROOT.length + 1)}`);
  console.log(`Index régénéré : ${await writeIndex()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
