#!/usr/bin/env node
/**
 * Relevé quotidien des sources publiques pour les artistes réels de la démo.
 * Écrit src/lib/real/snapshots/<id>/<YYYY-MM-DD>.json puis régénère l'index.
 * Une source qui échoue ne bloque pas les autres : champ null + ligne "⚠".
 *
 * Volume : une requête par source et par artiste (Spotify SSR + page rendue,
 * Kworb, Deezer ×2, YouTube : une page par clip connu). Pas de proxy, pas de login.
 *
 * Usage : npm run snapshot            (date du jour, heure de Paris)
 *         npm run snapshot -- 2026-09-16
 *         npm run snapshot -- --force  (écrase un relevé déjà présent pour cette date)
 *
 * Chaque relevé porte `capturedAt` (instant UTC de la capture) : il sert à
 * compter les rafraîchissements Spotify (un par jour, d'un bloc) et à
 * extrapoler les vues YouTube entre deux relevés. Un relevé existant pour la
 * même date n'est jamais écrasé en silence (sa capture serait perdue) : `--force`.
 *
 * Variables : YOUTUBE_API_KEY (optionnelle) → abonnés + 50 dernières vidéos de la chaîne.
 *
 * En fin de course, le relevé marché (Top 200 Spotify France + labels,
 * scripts/snapshot-market.mjs) est lancé avec la même date ; son échec est
 * signalé mais ne remet pas en cause les relevés artistes déjà écrits.
 */
import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { ROOT, SNAP_DIR, isSnapFile, writeIndex } from "./snapshot-index.mjs";

/*
 * Mesuré le 15/09/2026 : avec NODE_USE_SYSTEM_CA=1 (trousseau macOS), Node refuse la
 * chaîne TLS d'api.deezer.com (Gandi → USERTrust, cross-signée « AAA Certificate
 * Services ») : UNABLE_TO_GET_ISSUER_CERT. Le magasin Mozilla embarqué l'accepte.
 * On se relance donc une fois avec le magasin embarqué plutôt que de perdre Deezer.
 */
if (process.env.NODE_USE_SYSTEM_CA === "1") {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_SYSTEM_CA: "0" },
  });
  process.exit(r.status ?? 1);
}

const ARTISTS_FILE = join(ROOT, "scripts/artists.json");
/** UA navigateur : YouTube, Kworb, Deezer et la page Spotify rendue. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
/**
 * UA "non navigateur" : mesuré le 15/09/2026, open.spotify.com ne sert la page
 * SSR (auditeurs mensuels + 5 titres populaires avec playcounts) qu'à un
 * client sans UA Chrome/Safari ; avec un UA navigateur il renvoie la coquille SPA.
 */
const UA_PLAIN = "from-day1-snapshot/1.0";
// Date locale Europe/Paris (un relevé lancé à 01:00 à Paris est encore la veille en UTC).
const parisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const force = process.argv.includes("--force");
const date = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? parisToday();
const YT_KEY = process.env.YOUTUBE_API_KEY ?? null;

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Date invalide : ${date} (attendu YYYY-MM-DD)`);
  process.exit(1);
}

const warn = (msg) => console.warn(`⚠ ${msg}`);
/** "6,481,936" / "24 468" / "24 468" → 6481936 / 24468 (0 si rien). */
const num = (s) => Number(String(s).replace(/[^0-9]/g, "")) || 0;
/** Décodage minimal des entités HTML rencontrées dans les titres (« J&#x27;tavais dit », « &amp; »). */
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
/** Une ligne "compteur" : chiffres + séparateurs (espace, espace insécable, point, virgule). */
const COUNT_LINE = /^[0-9][0-9\s.,]*$/;

async function text(url, { userAgent = UA } = {}) {
  const res = await fetch(url, {
    headers: { "user-agent": userAgent, "accept-language": "fr-FR,fr;q=0.9" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

/* ── Spotify : HTML SSR (auditeurs mensuels + 5 titres populaires avec playcount) ── */
async function spotifyStatic(spotifyId) {
  const html = await text(`https://open.spotify.com/artist/${spotifyId}`, { userAgent: UA_PLAIN });
  // <div data-testid="monthly-listeners-label">6,481,936 monthly listeners</div>
  //                                            24 468 auditeurs mensuels (locale fr)
  const label = html.match(/data-testid="monthly-listeners-label"[^>]*>([^<]+)</)?.[1];
  const monthlyListeners = label && /[0-9]/.test(label) ? num(label) : null;

  // Lignes <div ... aria-labelledby="listrow-title-track-spotify:track:<id>-0" aria-label="Reine" data-testid="track-row">…Reine 228,954,362…
  const topTracks = [];
  const rowRe = /<div[^>]*data-testid="track-row"[^>]*>([\s\S]*?)(?=<div[^>]*data-testid="track-row"|data-testid="popular-releases-text"|<\/section>)/g;
  for (const m of html.matchAll(rowRe)) {
    const open = m[0].match(/^<div[^>]*>/)?.[0] ?? "";
    const id = open.match(/spotify:track:([A-Za-z0-9]+)/)?.[1] ?? null;
    const name = open.match(/aria-label="([^"]*)"/)?.[1];
    const plain = m[1].replace(/<[^>]+>/g, "\n");
    // Le playcount est la première "ligne" purement numérique (hors titre lui-même).
    const count = plain
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length >= 3 && l !== name && COUNT_LINE.test(l));
    if (name && count) topTracks.push({ name: unescapeHtml(name), spotifyId: id, playcount: num(count) });
  }
  return { monthlyListeners, topTracks };
}

/* ── Spotify : page rendue (abonnés + villes via la modale "Plus d'infos", repli titres) ── */
async function spotifyRendered(browser, spotifyId) {
  const page = await browser.newPage({ userAgent: UA, locale: "fr-FR", viewport: { width: 1400, height: 1000 } });
  const out = { topTracks: [], topCities: null, followers: null, monthlyListeners: null };
  try {
    await page.goto(`https://open.spotify.com/intl-fr/artist/${spotifyId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    // Bandeau cookies : on refuse (option la plus protectrice).
    const rejectBtn = page.getByRole("button", { name: /tout refuser|reject all/i });
    if (await rejectBtn.count()) await rejectBtn.first().click().catch(() => {});
    await page.waitForTimeout(500);

    // Titres populaires : [data-testid="tracklist-row"] → "1\nOdjo\n203 809\n2:43" (parfois un "E" explicite avant le compteur)
    const rows = await page.locator('[data-testid="tracklist-row"]').allInnerTexts();
    for (const r of rows) {
      const lines = r.split("\n").map((l) => l.trim()).filter(Boolean);
      const name = lines[1];
      const count = lines.find((l, i) => i > 1 && COUNT_LINE.test(l));
      if (name && count) out.topTracks.push({ name, spotifyId: null, playcount: num(count) });
    }
    // En-tête : "<span>24 468 auditeurs mensuels</span>" juste après [data-testid="entityTitle"]
    const header = await page
      .locator('[data-testid="entityTitle"]')
      .locator("xpath=..")
      .locator("xpath=..")
      .innerText({ timeout: 5000 })
      .catch(() => "");
    const ml = header.match(/([0-9][0-9\s.,]*)\s*(auditeurs mensuels|monthly listeners)/i);
    if (ml) out.monthlyListeners = num(ml[1]);

    // Villes + abonnés : <h2>Plus d'infos</h2> puis <button aria-label="<artiste>"> ; le clic ouvre un <dialog>
    // natif (frère dans le même conteneur) dont le texte est :
    //   "22 599\nAbonnés\n24 468\nAuditeurs chaque mois\nLomé, TG\n4 613 auditeurs\nAbidjan, CI\n2 702 auditeurs…"
    const aboutBox = page.locator("h2", { hasText: /^(Plus d'infos|About)$/ }).locator("xpath=..");
    if (await aboutBox.count()) {
      const btn = aboutBox.locator("button").first();
      await btn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await btn.click({ timeout: 5000 });
      const dialog = aboutBox.locator("dialog[open]").first();
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const body = await dialog.innerText();
      const fol = body.match(/([0-9][0-9\s.,]*)\n\s*(Abonnés|Followers)\b/i);
      if (fol) out.followers = num(fol[1]);
      const cities = [];
      for (const m of body.matchAll(/^([^\n,]+?),\s*([A-Z]{2})\n\s*([0-9][0-9\s.,]*)\s*(auditeurs|listeners)/gim)) {
        cities.push({ city: m[1].trim(), country: m[2].trim(), listeners: num(m[3]) });
      }
      out.topCities = cities.length ? cities.slice(0, 5) : null;
      if (!cities.length) warn(`spotify ${spotifyId} : modale ouverte mais aucune ville reconnue dans « ${body.slice(0, 120).replace(/\n/g, " / ")} »`);
    } else {
      warn(`spotify ${spotifyId} : bloc "Plus d'infos" introuvable`);
    }
  } catch (e) {
    warn(`spotify rendu ${spotifyId} : ${e.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
  return out;
}

/* ── Kworb : total + quotidien par titre ── */
async function kworb(spotifyId) {
  let html;
  try {
    html = await text(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`);
  } catch (e) {
    warn(`kworb ${spotifyId} : ${e.message} (artiste non suivi par Kworb ?)`);
    return null;
  }
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => unescapeHtml(c[1].replace(/<[^>]+>/g, "").trim())),
  );
  const totals = rows.find((r) => r[0] === "Streams");
  const daily = rows.find((r) => r[0] === "Daily");
  if (!totals) {
    warn(`kworb ${spotifyId} : ligne "Streams" introuvable (structure changée ?)`);
    return null;
  }
  const tracks = rows
    .filter((r) => r.length === 3 && /^[0-9,]+$/.test(r[1]))
    .map((r) => ({ name: r[0].replace(/^\*\s*/, ""), total: num(r[1]), daily: r[2] ? num(r[2]) : null }));
  return { totalStreams: num(totals[1]), dailyStreams: daily ? num(daily[1]) : 0, tracks };
}

/* ── Deezer : API publique ── */
async function deezer(deezerId) {
  if (!deezerId) return null;
  let a;
  try {
    a = JSON.parse(await text(`https://api.deezer.com/artist/${deezerId}`));
  } catch (e) {
    const code = e.cause?.code;
    throw new Error(`${e.message}${code ? ` (${code}` + (code === "UNABLE_TO_GET_ISSUER_CERT" ? " — relancer avec NODE_USE_SYSTEM_CA=0)" : ")") : ""}`);
  }
  if (a.error) throw new Error(`deezer ${deezerId} : ${a.error.message ?? JSON.stringify(a.error)}`);
  const top = JSON.parse(await text(`https://api.deezer.com/artist/${deezerId}/top?limit=10`));
  return {
    fans: a.nb_fan ?? 0,
    topTracks: (top.data ?? []).map((t) => ({ title: t.title, rank: t.rank })),
  };
}

/* ── YouTube : API officielle si clé, sinon pages publiques des vidéos connues ── */
async function ytApi(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", YT_KEY);
  // fetch direct (pas text()) : ne jamais faire apparaître l'URL — donc la clé — dans un message d'erreur.
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`youtube api ${path} : HTTP ${res.status} ${json.error?.message ?? ""}`.trim());
  return json;
}

/** Vues d'une vidéo depuis sa page publique : "viewCount":"439698165". */
async function ytPageViews(videoId) {
  const html = await text(`https://www.youtube.com/watch?v=${videoId}`);
  const m = html.match(/"viewCount":"([0-9]+)"/);
  if (!m) throw new Error(`viewCount absent de la page ${videoId}`);
  return num(m[1]);
}

async function youtube(channelId, knownVideos) {
  const known = knownVideos ?? [];
  // Sans clé API, seule la liste des vidéos connues est mesurable.
  if (!(YT_KEY && channelId) && !known.length) return null;

  let subscribers = null;
  const videos = [];
  const seen = new Set();

  if (YT_KEY && channelId) {
    // channels → playlist "uploads" → 50 derniers éléments → statistiques des vidéos
    const ch = await ytApi("channels", { part: "statistics,contentDetails", id: channelId });
    const item = ch.items?.[0];
    if (!item) throw new Error(`youtube api : chaîne ${channelId} introuvable`);
    subscribers = item.statistics?.hiddenSubscriberCount ? null : num(item.statistics?.subscriberCount);
    const uploads = item.contentDetails?.relatedPlaylists?.uploads;
    const ids = [];
    if (uploads) {
      const pl = await ytApi("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "50" });
      for (const it of pl.items ?? []) ids.push(it.contentDetails.videoId);
    }
    for (let i = 0; i < ids.length; i += 50) {
      const vs = await ytApi("videos", { part: "statistics,snippet", id: ids.slice(i, i + 50).join(",") });
      for (const v of vs.items ?? []) {
        seen.add(v.id);
        videos.push({ videoId: v.id, title: v.snippet.title, channel: "official", views: num(v.statistics.viewCount) });
      }
    }
  }

  // Vidéos connues (relevé précédent + amorce artists.json) hors de celles déjà couvertes par l'API
  for (const v of known) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    try {
      videos.push({ videoId: v.videoId, title: v.title, channel: v.channel ?? "official", views: await ytPageViews(v.videoId) });
    } catch (e) {
      // Vues non mesurées aujourd'hui : on reporte la dernière valeur connue (signalée) pour ne pas
      // perdre la vidéo de la chaîne de relevés ; une amorce sans valeur connue est simplement ignorée.
      if (v.views) {
        warn(`youtube ${v.videoId} : ${e.message} — dernière valeur connue reportée (${v.views})`);
        videos.push({ videoId: v.videoId, title: v.title, channel: v.channel ?? "official", views: v.views });
      } else {
        warn(`youtube ${v.videoId} : ${e.message} — vidéo ignorée (aucune valeur connue)`);
      }
    }
  }
  return { subscribers, videos };
}

/* ── Fichiers ── */
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Relevés déjà présents pour `date` parmi les artistes (chemins). */
async function existingSnapshots(artists) {
  const paths = artists.map((a) => join(SNAP_DIR, a.id, `${date}.json`));
  const flags = await Promise.all(paths.map(exists));
  return paths.filter((_, i) => flags[i]);
}

/** Dernier relevé strictement antérieur à `date`, ou null. */
async function previousSnapshot(id) {
  let files;
  try {
    files = await readdir(join(SNAP_DIR, id));
  } catch {
    return null;
  }
  const prev = files
    .filter(isSnapFile)
    .map((f) => f.slice(0, 10))
    .filter((d) => d < date)
    .sort()
    .at(-1);
  if (!prev) return null;
  return JSON.parse(await readFile(join(SNAP_DIR, id, `${prev}.json`), "utf8"));
}

/* ── main ── */
async function main() {
  const artists = JSON.parse(await readFile(ARTISTS_FILE, "utf8"));
  // Un second relevé le même jour écraserait le premier : on perdrait sa capture
  // (et donc le delta de la veille). Refus explicite, sauf --force.
  const already = await existingSnapshots(artists);
  if (already.length && !force) {
    warn(`relevé du ${date} déjà présent (${already.map((p) => p.slice(SNAP_DIR.length + 1)).join(", ")}) — rien écrit. Relancer avec --force pour écraser.`);
    process.exit(1);
  }
  console.log(`Relevé du ${date} — ${artists.length} artistes${YT_KEY ? " (YouTube API)" : " (YouTube sans clé : pages publiques)"}${already.length ? " — --force : écrase le relevé existant" : ""}`);
  const browser = await chromium.launch();
  try {
    for (const a of artists) {
      console.log(`\n▶ ${a.name} (${a.id})`);
      const prev = await previousSnapshot(a.id);
      // Vidéos connues : relevé précédent ∪ amorce artists.json (dédoublonnées par videoId)
      const knownVideos = [...(prev?.youtube?.videos ?? [])];
      for (const v of a.youtubeVideos ?? []) {
        if (!knownVideos.some((k) => k.videoId === v.videoId)) knownVideos.push({ ...v, channel: "official", views: 0 });
      }

      const fail = (label, fallback) => (e) => {
        warn(`${label} ${a.id} : ${e.message.split("\n")[0]}`);
        return fallback;
      };
      // Instant de la capture (UTC) : sert à normaliser les deltas par le temps écoulé.
      const capturedAt = new Date().toISOString();
      const [stat, rend, kw, dz, yt] = await Promise.all([
        spotifyStatic(a.spotifyId).catch(fail("spotify statique", { monthlyListeners: null, topTracks: [] })),
        spotifyRendered(browser, a.spotifyId).catch(fail("spotify rendu", { topTracks: [], topCities: null, followers: null, monthlyListeners: null })),
        kworb(a.spotifyId).catch(fail("kworb", null)),
        deezer(a.deezerId).catch(fail("deezer", null)),
        youtube(a.youtubeChannelId, knownVideos).catch(fail("youtube", null)),
      ]);

      // Titres : SSR (avec ids Spotify) en priorité, page rendue en repli
      const topTracks = stat.topTracks.length ? stat.topTracks : rend.topTracks;
      const snapshot = {
        date,
        capturedAt,
        spotify: {
          monthlyListeners: stat.monthlyListeners ?? rend.monthlyListeners ?? null,
          followers: rend.followers,
          topTracks,
        },
        kworb: kw,
        deezer: dz,
        youtube: yt,
        topCities: rend.topCities,
      };

      if (snapshot.spotify.monthlyListeners === null) warn(`${a.id} : auditeurs mensuels Spotify non obtenus`);
      if (!topTracks.length) warn(`${a.id} : aucun titre populaire Spotify obtenu`);
      if (snapshot.spotify.followers === null) warn(`${a.id} : abonnés Spotify non obtenus`);
      if (!kw) warn(`${a.id} : kworb null`);
      if (!dz) warn(`${a.id} : deezer null${a.deezerId ? "" : " (deezerId absent)"}`);
      if (!yt) warn(`${a.id} : youtube null${a.youtubeChannelId ? "" : " (youtubeChannelId absent)"}${knownVideos.length ? "" : " (aucune vidéo connue)"}`);
      if (!snapshot.topCities) warn(`${a.id} : villes non obtenues`);

      const dir = join(SNAP_DIR, a.id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${date}.json`), JSON.stringify(snapshot, null, 2) + "\n");

      const fmt = (v) => (v === null || v === undefined ? "—" : String(v));
      console.log(
        `  auditeurs=${fmt(snapshot.spotify.monthlyListeners)} abonnés=${fmt(snapshot.spotify.followers)} top5=${topTracks.length}` +
          ` kworbDaily=${fmt(kw?.dailyStreams)} titres=${fmt(kw?.tracks.length)} deezerFans=${fmt(dz?.fans)}` +
          ` yt=${yt ? `${yt.videos.length} vidéos` : "—"} villes=${snapshot.topCities ? snapshot.topCities.length : "—"}`,
      );
    }
  } finally {
    await browser.close();
  }
  console.log(`\nIndex régénéré : ${await writeIndex()}`);

  // Relevé marché (Top 200 France + labels) : même date, même --force.
  console.log("");
  const market = spawnSync(
    process.execPath,
    ["--no-warnings", join(ROOT, "scripts/snapshot-market.mjs"), date, ...(force ? ["--force"] : [])],
    { stdio: "inherit", env: process.env },
  );
  if (market.status !== 0) warn(`relevé marché en échec (code ${market.status ?? "?"}) — relevés artistes conservés`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
