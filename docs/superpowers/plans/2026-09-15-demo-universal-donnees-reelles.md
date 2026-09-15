# Démo Universal — données réelles + algo Day 1 + canal Universal — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire tourner Day 1 Dashboard Pro sur les vrais streams de Kiko, Dadju et Nono La Grinta, avec l'estimateur de revenus « stream rémunérateur », et ajouter l'écran co-brandé `/welcome?source=universal` — prêt pour la présentation à Universal du jeudi 18 septembre 2026.

**Architecture:** Une couche `src/lib/real/` (snapshots JSON commités + reconstruction + estimateur) branchée derrière la façade `src/lib/demo/api.ts` existante : les pages ne changent pas d'API, elles reçoivent des séries qui portent une `provenance`. Le roster démo est remplacé par les trois artistes réels. Une route `/welcome` hors du groupe `(dashboard)` porte l'onboarding co-brandé.

**Tech Stack:** Next 16 (App Router), TypeScript strict, vitest, Playwright (`@playwright/test`, déjà installé, Chromium présent), next-intl (fr/en, ESLint anti-hardcode), Tailwind v4 + shadcn, recharts, NumberFlow.

**Spec :** `docs/superpowers/specs/2026-09-15-demo-universal-donnees-reelles-design.md` — le plan renvoie à ses sections (§).

**Conventions du repo à respecter :**
- Commentaires et libellés de code en français, comme le code existant.
- Zéro chaîne UI en dur dans `src/app/**` et `src/components/**` (hors `ui/`) : tout passe par `useTranslations`, et chaque clé fr a sa jumelle en (test `src/messages/__tests__/parity.test.ts`).
- Déterminisme absolu des séries (hydration) : jamais `Math.random()` ni `Date.now()` ; on utilise `rngFor(key)` de `src/lib/demo/seed.ts` et `DEMO_TODAY`.
- Tests unitaires dans `src/**/__tests__/*.test.ts`, lancés avec `npm test` (vitest, environnement node).
- Commits fréquents, messages en français, suffixe `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Carte des fichiers

**Créés**

| Fichier | Responsabilité |
|---|---|
| `scripts/artists.json` | Les 3 artistes : ids Spotify / Deezer / YouTube, pays |
| `scripts/snapshot.mjs` | Relève les sources publiques, écrit un snapshot daté par artiste, régénère l'index |
| `src/lib/real/snapshots/<artistId>/<date>.json` | Données brutes d'un jour (commitées) |
| `src/lib/real/snapshots/index.ts` | Généré : import de tous les snapshots + `LATEST_DATE` |
| `src/lib/real/types.ts` | Types `Snapshot`, `Provenance`, `Range`, `Confidence` |
| `src/lib/real/params.ts` | Tous les paramètres chiffrés (taux SNEP, coefficients DSP, zones, seuils) avec leur source |
| `src/lib/real/reconstruct.ts` | Reconstitution déterministe d'un historique quotidien par titre (§4.3) |
| `src/lib/real/dsp-mix.ts` | Mix DSP France corrigé par artiste (§5.2) |
| `src/lib/real/territory.ts` | Villes → zones → coefficient territorial ; villes → pays pour la carte (§5.1 pt 4) |
| `src/lib/real/estimator.ts` | Stream rémunérateur → € brut master en fourchette, confiance, cascades (§5.1) |
| `src/lib/real/calibration.ts` | Taux et mix réels depuis un relevé importé (§5.3) |
| `src/lib/real/audit-gap.ts` | Écart estimé/déclaré → `AuditFinding` attribués au DSP (§5.4) |
| `src/lib/real/real-source.ts` | Adaptateur : snapshots → séries de la forme attendue par `api.ts` (§4.4) |
| `src/lib/real/index.ts` | Point d'entrée : `hasRealData`, ré-exports |
| `src/components/ui/provenance-badge.tsx` | Badge mesuré / reconstitué / estimé / simulé |
| `src/components/modules/pilotage/estimate-board.tsx` | Tuiles jour / semaine / mois / année en fourchette + confiance |
| `src/app/welcome/page.tsx` | Route `/welcome?source=…` (hors sidebar) |
| `src/components/modules/welcome/sources.ts` | Config par canal (couleurs, initiales, nb d'étapes, sidebar) |
| `src/components/modules/welcome/cobrand-screen.tsx` | L'écran co-brandé |
| `src/messages/{fr,en}/welcome.json` | Textes des onboardings |
| `docs/superpowers/qa/2026-09-15-etat-temoin.md` | Sortie brute build/test/lint avant travaux |

**Modifiés**

| Fichier | Changement |
|---|---|
| `package.json` | script `snapshot` |
| `src/lib/demo/types.ts` | `Provenance`, `StreamPoint.provenance?`, ids externes sur `Artist` |
| `src/lib/demo/seed.ts` | `DEMO_TODAY` = `LATEST_DATE` des snapshots |
| `src/lib/demo/data.ts` | `LABEL`, `ARTISTS`, `PROJECT_SEEDS`, `CONTRACTS`, `TEAM.artistAccess` → roster réel |
| `src/lib/demo/generators.ts` | `revenueSeries` accepte un override des montants streaming |
| `src/lib/demo/api.ts` | Routage vers `real-source` ; nouveaux exports `dailyEstimates`, `estimateSummary`, `provenanceByDsp` |
| `src/lib/role.tsx` | `DEMO_ARTIST_ID = "dadju"` |
| `src/components/dashboard/topbar.tsx` | `"sky-lune"` → `DEMO_ARTIST_ID` |
| `src/components/modules/algo/discovery-data.tsx` | clé de repli = premier artiste |
| `src/components/dashboard/kpi.tsx` | prop `provenance?` |
| `src/app/(dashboard)/pulse/page.tsx` | KPI gains estimés (hier / semaine) + badges |
| `src/app/(dashboard)/revenue/page.tsx` | section « Estimation live » |
| `src/app/(dashboard)/streams/page.tsx` | légende mesuré / estimé par DSP |
| `src/messages/{fr,en}/{common,pulse,revenue,streams,onboardings}.json` | nouvelles clés |
| `src/messages/index.ts` | namespace `welcome` |
| `src/components/modules/pitch/partner-board.tsx` | partenaire `universal` |
| `src/lib/demo/__tests__/{determinism,forecast,pnl}.test.ts` | ids du nouveau roster |

---

## Task 0 : État témoin

**Files:**
- Create: `docs/superpowers/qa/2026-09-15-etat-temoin.md`

- [ ] **Step 1 : Lancer les trois commandes et conserver la sortie brute**

```bash
cd "/Users/cluzelgael/DAY 2/from-day1-dashboard" && mkdir -p docs/superpowers/qa && { echo "# État témoin — $(date -u +%Y-%m-%dT%H:%MZ) — commit $(git rev-parse --short HEAD)"; echo; echo '## npm run lint'; echo '```'; npm run lint 2>&1 | tail -40; echo '```'; echo '## npm test'; echo '```'; npm test 2>&1 | tail -40; echo '```'; echo '## npm run build'; echo '```'; npm run build 2>&1 | tail -60; echo '```'; } > docs/superpowers/qa/2026-09-15-etat-temoin.md; tail -30 docs/superpowers/qa/2026-09-15-etat-temoin.md
```

Attendu : lint sans erreur (warnings i18n tolérés), `Test Files … passed`, `Tests 194 passed`, build `✓ Compiled` avec la liste des 29+ routes. Si quelque chose est rouge, **on le note dans le fichier et on le signale à Gaël avant de continuer** — c'est l'état de départ, il ne s'invente pas.

- [ ] **Step 2 : Commit**

```bash
git add docs/superpowers/qa/2026-09-15-etat-temoin.md && git commit -m "qa: état témoin avant chantier démo Universal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 1 : Types et paramètres

**Files:**
- Create: `src/lib/real/types.ts`, `src/lib/real/params.ts`
- Modify: `src/lib/demo/types.ts`
- Test: `src/lib/real/__tests__/params.test.ts`

- [ ] **Step 1 : Étendre le contrat de domaine**

Dans `src/lib/demo/types.ts`, après `export type CareerStage`, ajouter :

```ts
/** D'où vient un chiffre — affiché dans l'UI, jamais caché. */
export type Provenance = "measured" | "reconstructed" | "estimated" | "simulated";
```

Dans `Artist`, après `country: string;` :

```ts
  /** Identifiants externes (artistes réels de la démo). */
  spotifyId?: string;
  deezerId?: string;
  youtubeChannelId?: string;
```

Dans `StreamPoint`, après `streams: number;` :

```ts
  provenance?: Provenance;
```

- [ ] **Step 2 : Créer les types de la couche réelle**

`src/lib/real/types.ts` :

```ts
import type { DSP, Provenance } from "@/lib/demo/types";

export type { Provenance };

export type SnapshotTrack = { name: string; total: number; daily: number | null };
export type SnapshotVideo = {
  videoId: string;
  title: string;
  channel: "official" | "topic";
  views: number;
};
export type SnapshotCity = { city: string; country: string; listeners: number };

/** Un relevé quotidien d'un artiste — fichier src/lib/real/snapshots/<id>/<date>.json */
export type Snapshot = {
  date: string; // YYYY-MM-DD
  spotify: {
    monthlyListeners: number | null;
    followers: number | null;
    topTracks: Array<{ name: string; spotifyId: string | null; playcount: number }>;
  };
  kworb: {
    totalStreams: number;
    dailyStreams: number;
    tracks: SnapshotTrack[];
  } | null;
  deezer: { fans: number; topTracks: Array<{ title: string; rank: number }> } | null;
  youtube: { subscribers: number | null; videos: SnapshotVideo[] } | null;
  topCities: SnapshotCity[] | null;
};

export type Range = { low: number; mid: number; high: number };
export type Confidence = "high" | "medium" | "indicative";

export type DailyEstimate = {
  date: string;
  streams: number;
  payableStreams: number;
  byDsp: Partial<Record<DSP, { streams: number; gross: Range; provenance: Provenance }>>;
  grossMaster: Range;
  provenance: Provenance;
};

export type EstimatePeriod = "day" | "week" | "month" | "year";

export type EstimateSummary = {
  period: EstimatePeriod;
  from: string;
  to: string;
  streams: number;
  payableStreams: number;
  grossMaster: Range;
  artistShare: Range;
  publishing: Range;
  confidence: Confidence;
  provenance: Provenance;
  calibrated: boolean;
};
```

- [ ] **Step 3 : Écrire le test des paramètres**

`src/lib/real/__tests__/params.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  DSP_COEF,
  MARKET_MIX_FR,
  RATE_FR,
  TERRITORY_COEF,
  ZONE_DEFAULTS,
  blendedRate,
} from "@/lib/real/params";

describe("paramètres de l'estimateur", () => {
  it("le taux premium France est celui du SNEP 2025 (553 M€ / 122 Md)", () => {
    expect(RATE_FR.premium).toBeCloseTo(553e6 / 122e9, 8);
    expect(RATE_FR.premium).toBeGreaterThan(0.004);
    expect(RATE_FR.premium).toBeLessThan(0.005);
  });

  it("le taux mixé 80/20 est entre le gratuit et le premium", () => {
    const b = blendedRate({ premium: 0.8, free: 0.2 });
    expect(b).toBeGreaterThan(RATE_FR.free);
    expect(b).toBeLessThan(RATE_FR.premium);
  });

  it("le mix de marché somme à 1", () => {
    const sum = Object.values(MARKET_MIX_FR).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("chaque coefficient DSP est ordonné low ≤ mid ≤ high", () => {
    for (const c of Object.values(DSP_COEF)) {
      expect(c.low).toBeLessThanOrEqual(c.mid);
      expect(c.mid).toBeLessThanOrEqual(c.high);
    }
  });

  it("les zones par défaut somment à 1 pour chaque pays connu", () => {
    for (const dist of Object.values(ZONE_DEFAULTS)) {
      expect(Object.values(dist).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    }
    expect(TERRITORY_COEF.africa).toBeLessThan(TERRITORY_COEF.frbech);
  });
});
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/real/__tests__/params.test.ts`
Attendu : FAIL — `Cannot find module '@/lib/real/params'`.

- [ ] **Step 5 : Écrire `src/lib/real/params.ts`**

```ts
/**
 * Paramètres de l'estimateur « stream rémunérateur » (spec §5.1, §5.2).
 * Chaque valeur porte sa source. MESURÉ = chiffre publié ; HYPOTHÈSE = valeur
 * de départ à recaler par relevé (calibration.ts).
 */
import type { DSP } from "@/lib/demo/types";
import type { Range } from "./types";

/* ─── Ancrage France — MESURÉ, SNEP bilan 2025 (revenus producteurs) ─── */
export const SNEP_2025 = {
  premiumRevenueEur: 553_000_000,
  premiumStreams: 122_000_000_000,
  /** Déduit de « audio gratuit +12 %, soit +9 M€ » → ≈ 84 M€ en 2025. */
  freemiumRevenueEur: 84_000_000,
  /** 122 Md = 80 % des streams audio → ≈ 30 Md de streams gratuits. */
  freemiumStreams: 30_000_000_000,
  source: "https://snepmusique.com/communiques-dossiers-de-presse/bilan-2025-snep/",
} as const;

export const RATE_FR = {
  premium: SNEP_2025.premiumRevenueEur / SNEP_2025.premiumStreams, // ≈ 0,00453 €
  free: SNEP_2025.freemiumRevenueEur / SNEP_2025.freemiumStreams, // ≈ 0,0028 €
} as const;

export type Tier = { premium: number; free: number };
/** Part premium/gratuit France — MESURÉ (80 % des streams audio sont premium). */
export const TIER_FR: Tier = { premium: 0.8, free: 0.2 };

export function blendedRate(tier: Tier): number {
  return RATE_FR.premium * tier.premium + RATE_FR.free * tier.free;
}

/* ─── Coefficients par DSP, appliqués au taux France mixé — HYPOTHÈSES ─── */
export const DSP_COEF: Record<DSP, Range> = {
  spotify: { low: 0.75, mid: 0.85, high: 0.95 },
  deezer: { low: 1.0, mid: 1.15, high: 1.3 },
  apple: { low: 1.25, mid: 1.45, high: 1.65 },
  amazon: { low: 0.85, mid: 1.0, high: 1.15 },
  /** Vues YouTube : mélange clips (AVOD) et art tracks « Topic » — voir YOUTUBE_COEF. */
  youtube: { low: 0.2, mid: 0.3, high: 0.45 },
  /** TikTok n'est pas un stream rémunéré au sens DSP. */
  tiktok: { low: 0, mid: 0, high: 0 },
  other: { low: 0.7, mid: 0.9, high: 1.1 },
};

export const YOUTUBE_COEF: Record<"official" | "topic", Range> = {
  official: { low: 0.2, mid: 0.25, high: 0.3 },
  topic: { low: 0.6, mid: 0.7, high: 0.8 },
};

/* ─── Parts de marché France par DSP — HYPOTHÈSE (streams audio + vidéo) ─── */
export const MARKET_MIX_FR: Record<DSP, number> = {
  spotify: 0.55,
  deezer: 0.17,
  apple: 0.14,
  amazon: 0.06,
  youtube: 0.05,
  tiktok: 0,
  other: 0.03,
};

/** Médiane de marché du ratio fans Deezer / auditeurs mensuels Spotify — HYPOTHÈSE. */
export const DEEZER_RATIO_MEDIAN = 0.25;
export const DEEZER_RATIO_CLAMP: [number, number] = [0.5, 2.5];

/* ─── Deezer artist-centric (UMG × Deezer 2023, SACEM 2025) — règles PUBLIÉES ─── */
export const DEEZER_ARTIST_CENTRIC = {
  proThreshold: { streamsPerMonth: 1_000, uniqueListeners: 500 },
  proBoost: 2,
  activeBoost: 2,
  /** Part d'écoutes actives (recherche, playlist non algo) — HYPOTHÈSE. */
  activeShareDefault: 0.4,
  /** Poids moyen d'un stream Deezer dans le pool (pro-rata boosté) — HYPOTHÈSE. */
  averageWeight: 1.6,
} as const;

/* ─── Seuils de rémunérabilité — règles PUBLIÉES ─── */
export const SPOTIFY_MIN_STREAMS_12M = 1_000;
export const MIN_STREAM_SECONDS = 30;

/* ─── Territoires — HYPOTHÈSES (fraction du taux France) ─── */
export type Zone = "frbech" | "europe" | "northAmerica" | "africa" | "rest";
export const ZONES: Zone[] = ["frbech", "europe", "northAmerica", "africa", "rest"];
export const TERRITORY_COEF: Record<Zone, number> = {
  frbech: 1.0,
  europe: 0.9,
  northAmerica: 1.1,
  africa: 0.15,
  rest: 0.5,
};
/** Répartition par défaut quand on n'a pas les villes, selon le pays de l'artiste. */
export const ZONE_DEFAULTS: Record<string, Record<Zone, number>> = {
  FR: { frbech: 0.7, europe: 0.12, northAmerica: 0.08, africa: 0.05, rest: 0.05 },
  TG: { frbech: 0.35, europe: 0.08, northAmerica: 0.05, africa: 0.45, rest: 0.07 },
  default: { frbech: 0.6, europe: 0.15, northAmerica: 0.1, africa: 0.05, rest: 0.1 },
};

/* ─── Cascades — HYPOTHÈSES cohérentes avec dealType ─── */
export const DEAL_SHARE: Record<"licence" | "distribution" | "artiste" | "indé", Range> = {
  distribution: { low: 0.85, mid: 0.9, high: 1.0 },
  licence: { low: 0.24, mid: 0.27, high: 0.3 },
  artiste: { low: 0.18, mid: 0.2, high: 0.25 },
  indé: { low: 1, mid: 1, high: 1 },
};
/** Part du chiffre DSP qui part vers l'édition, et part de l'auteur dans l'édition. */
export const PUBLISHING_SHARE_OF_DSP = 0.15;
export const AUTHOR_SHARE_OF_PUBLISHING = 0.5;

/* ─── Audit — seuils ─── */
export const AUDIT_GAP_REL = 0.12;
export const AUDIT_GAP_ABS_EUR = 100;

/* ─── Reconstruction ─── */
export const RECONSTRUCT = {
  weekly: { fri: 1.1, sat: 1.1, sun: 1.03, mon: 0.95, other: 1.0 },
  noiseAmplitude: 0.08,
  releaseSpike: 3,
  releaseDecayDays: 45,
} as const;
```

- [ ] **Step 6 : Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/real/__tests__/params.test.ts`
Attendu : 5 tests PASS.

- [ ] **Step 7 : Vérifier que le reste compile toujours**

Run: `npx tsc --noEmit -p tsconfig.json`
Attendu : aucune erreur (les nouveaux champs sont optionnels).

- [ ] **Step 8 : Commit**

```bash
git add src/lib/demo/types.ts src/lib/real && git commit -m "feat(real): types de la couche réelle et paramètres de l'estimateur (ancrage SNEP 2025)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2 : Script de snapshot + premier relevé

**Files:**
- Create: `scripts/artists.json`, `scripts/snapshot.mjs`, `src/lib/real/snapshots/index.ts` (généré), `src/lib/real/snapshots/<id>/<date>.json` (générés)
- Modify: `package.json`

- [ ] **Step 1 : Décrire les artistes**

`scripts/artists.json` :

```json
[
  {
    "id": "kiko",
    "name": "Kiko",
    "country": "TG",
    "spotifyId": "4P2zZ1OLqeeKDLXc34Yfsv",
    "deezerId": null,
    "youtubeChannelId": null
  },
  {
    "id": "dadju",
    "name": "Dadju",
    "country": "FR",
    "spotifyId": "4sbXXFzEWJY2zsZjelerjX",
    "deezerId": "4803754",
    "youtubeChannelId": "UC8HMvOLE0etpO_eVjJ98bHA"
  },
  {
    "id": "nono-la-grinta",
    "name": "Nono La Grinta",
    "country": "FR",
    "spotifyId": "4P2HohWBtvSxxwabNDdYXN",
    "deezerId": "194146027",
    "youtubeChannelId": null
  }
]
```

Les `null` sont à compléter au fil des relevés (le script signale ce qu'il n'a pas pu relever). Pour trouver une chaîne YouTube : ouvrir un clip officiel, `curl -sA Mozilla "https://www.youtube.com/watch?v=<id>" | grep -oE '"channelId":"UC[A-Za-z0-9_-]{22}"' | head -1`. Pour Deezer : `curl -s "https://api.deezer.com/search/artist?q=kiko" | python3 -m json.tool` et choisir l'id dont `nb_album`/titres correspondent (vérifier avec `https://api.deezer.com/artist/<id>/top`).

- [ ] **Step 2 : Écrire le script**

`scripts/snapshot.mjs` :

```js
#!/usr/bin/env node
/**
 * Relevé quotidien des sources publiques pour les artistes réels de la démo.
 * Écrit src/lib/real/snapshots/<id>/<YYYY-MM-DD>.json puis régénère l'index.
 * Une source qui échoue ne bloque pas les autres : champ null + ligne "⚠".
 *
 * Usage : npm run snapshot            (date du jour, UTC)
 *         npm run snapshot -- 2026-09-16
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP_DIR = join(ROOT, "src/lib/real/snapshots");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const YT_KEY = process.env.YOUTUBE_API_KEY ?? null;

const warn = (msg) => console.warn(`⚠ ${msg}`);
const num = (s) => Number(String(s).replace(/[^0-9]/g, "")) || 0;

async function text(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fr-FR,fr;q=0.9" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

/* ── Spotify : HTML statique (auditeurs mensuels) ── */
async function spotifyStatic(spotifyId) {
  const html = await text(`https://open.spotify.com/artist/${spotifyId}`);
  const m = html.match(/([0-9][0-9.,  ]*) monthly listeners/);
  return { monthlyListeners: m ? num(m[1]) : null };
}

/* ── Spotify : page rendue (play counts top 5 + villes) ── */
async function spotifyRendered(browser, spotifyId) {
  const page = await browser.newPage({ userAgent: UA, locale: "fr-FR" });
  const out = { topTracks: [], topCities: null, followers: null };
  try {
    await page.goto(`https://open.spotify.com/intl-fr/artist/${spotifyId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const rejectBtn = page.getByRole("button", { name: /tout refuser|reject all/i });
    if (await rejectBtn.count()) await rejectBtn.first().click().catch(() => {});
    const rows = await page.locator('[data-testid="tracklist-row"]').allInnerTexts();
    for (const r of rows) {
      const lines = r.split("\n").map((l) => l.trim()).filter(Boolean);
      // Forme observée : ["1", "Odjo", "203 809", "2:43"] (les libellés "E" explicit s'intercalent parfois)
      const name = lines[1];
      const count = lines.find((l, i) => i > 1 && /^[0-9][0-9   .,]*$/.test(l));
      if (name && count) out.topTracks.push({ name, spotifyId: null, playcount: num(count) });
    }
    // Villes : le bloc "Plus d'infos" ouvre une modale avec "Ville, Pays  N auditeurs"
    const about = page.getByText(/auditeurs mensuels/i).last();
    if (await about.count()) {
      await about.click().catch(() => {});
      await page.waitForTimeout(1500);
      const body = await page.locator("body").innerText();
      const cities = [];
      for (const m of body.matchAll(/([^\n]+?),\s*([^\n]+?)\n\s*([0-9][0-9   .,]*)\s*auditeurs/g)) {
        cities.push({ city: m[1].trim(), country: m[2].trim(), listeners: num(m[3]) });
      }
      out.topCities = cities.length ? cities.slice(0, 5) : null;
    }
  } catch (e) {
    warn(`spotify rendu ${spotifyId} : ${e.message}`);
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
  } catch {
    return null;
  }
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").trim()),
  );
  const totals = rows.find((r) => r[0] === "Streams");
  const daily = rows.find((r) => r[0] === "Daily");
  if (!totals) return null;
  const tracks = rows
    .filter((r) => r.length === 3 && /^[0-9,]+$/.test(r[1]))
    .map((r) => ({ name: r[0].replace(/^\*\s*/, ""), total: num(r[1]), daily: r[2] ? num(r[2]) : null }));
  return { totalStreams: num(totals[1]), dailyStreams: daily ? num(daily[1]) : 0, tracks };
}

/* ── Deezer : API publique ── */
async function deezer(deezerId) {
  if (!deezerId) return null;
  const a = JSON.parse(await text(`https://api.deezer.com/artist/${deezerId}`));
  const top = JSON.parse(await text(`https://api.deezer.com/artist/${deezerId}/top?limit=10`));
  return { fans: a.nb_fan ?? 0, topTracks: (top.data ?? []).map((t) => ({ title: t.title, rank: t.rank })) };
}

/* ── YouTube : API officielle si clé, sinon pages publiques des vidéos connues ── */
async function youtube(channelId, previousVideos) {
  if (!channelId) return null;
  if (YT_KEY) {
    const ch = JSON.parse(
      await text(`https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${YT_KEY}`),
    );
    const item = ch.items?.[0];
    if (!item) return null;
    const uploads = item.contentDetails.relatedPlaylists.uploads;
    const pl = JSON.parse(
      await text(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${YT_KEY}`),
    );
    const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId).join(",");
    const vs = JSON.parse(
      await text(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`),
    );
    return {
      subscribers: num(item.statistics.subscriberCount),
      videos: (vs.items ?? []).map((v) => ({
        videoId: v.id,
        title: v.snippet.title,
        channel: "official",
        views: num(v.statistics.viewCount),
      })),
    };
  }
  // Sans clé : on relit les vidéos déjà connues du snapshot précédent (ou aucune).
  const videos = [];
  for (const v of previousVideos ?? []) {
    try {
      const html = await text(`https://www.youtube.com/watch?v=${v.videoId}`);
      const m = html.match(/"viewCount":"([0-9]+)"/);
      videos.push({ ...v, views: m ? num(m[1]) : v.views });
    } catch (e) {
      warn(`youtube ${v.videoId} : ${e.message}`);
      videos.push(v);
    }
  }
  return { subscribers: null, videos };
}

async function previousSnapshot(id) {
  try {
    const files = (await readdir(join(SNAP_DIR, id))).filter((f) => f.endsWith(".json")).sort();
    if (!files.length) return null;
    return JSON.parse(await readFile(join(SNAP_DIR, id, files[files.length - 1]), "utf8"));
  } catch {
    return null;
  }
}

async function writeIndex() {
  const ids = (await readdir(SNAP_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const imports = [];
  const entries = [];
  let latest = "1970-01-01";
  for (const id of ids) {
    const files = (await readdir(join(SNAP_DIR, id))).filter((f) => f.endsWith(".json")).sort();
    const vars = [];
    for (const f of files) {
      const d = f.replace(".json", "");
      if (d > latest) latest = d;
      const v = `${id.replace(/-/g, "_")}_${d.replace(/-/g, "_")}`;
      imports.push(`import ${v} from "./${id}/${f}";`);
      vars.push(v);
    }
    entries.push(`  "${id}": [${vars.join(", ")}] as Snapshot[],`);
  }
  const src = `/* Généré par scripts/snapshot.mjs — ne pas éditer à la main. */
import type { Snapshot } from "../types";
${imports.join("\n")}

export const SNAPSHOTS: Record<string, Snapshot[]> = {
${entries.join("\n")}
};

/** Date du relevé le plus récent — c'est « aujourd'hui » pour la démo. */
export const LATEST_DATE = "${latest}";
`;
  await writeFile(join(SNAP_DIR, "index.ts"), src);
}

const artists = JSON.parse(await readFile(join(ROOT, "scripts/artists.json"), "utf8"));
const browser = await chromium.launch();
for (const a of artists) {
  console.log(`— ${a.name} (${date})`);
  const prev = await previousSnapshot(a.id);
  const [stat, rendered, kw, dz, yt] = await Promise.all([
    spotifyStatic(a.spotifyId).catch((e) => (warn(`spotify ${a.id} : ${e.message}`), { monthlyListeners: null })),
    spotifyRendered(browser, a.spotifyId),
    kworb(a.spotifyId).catch((e) => (warn(`kworb ${a.id} : ${e.message}`), null)),
    deezer(a.deezerId).catch((e) => (warn(`deezer ${a.id} : ${e.message}`), null)),
    youtube(a.youtubeChannelId, prev?.youtube?.videos).catch((e) => (warn(`youtube ${a.id} : ${e.message}`), null)),
  ]);
  const snap = {
    date,
    spotify: { monthlyListeners: stat.monthlyListeners, followers: rendered.followers, topTracks: rendered.topTracks },
    kworb: kw,
    deezer: dz,
    youtube: yt,
    topCities: rendered.topCities,
  };
  if (!kw) warn(`${a.id} : absent de Kworb (attendu pour Kiko)`);
  if (!rendered.topTracks.length) warn(`${a.id} : aucun play count relevé sur la page rendue`);
  if (!rendered.topCities) warn(`${a.id} : villes non relevées`);
  await mkdir(join(SNAP_DIR, a.id), { recursive: true });
  await writeFile(join(SNAP_DIR, a.id, `${date}.json`), JSON.stringify(snap, null, 2) + "\n");
  console.log(
    `  auditeurs=${stat.monthlyListeners} kworbDaily=${kw?.dailyStreams ?? "—"} titres=${kw?.tracks.length ?? rendered.topTracks.length} deezerFans=${dz?.fans ?? "—"} yt=${yt?.videos.length ?? "—"} villes=${rendered.topCities?.length ?? "—"}`,
  );
}
await browser.close();
await writeIndex();
console.log("index régénéré :", join(SNAP_DIR, "index.ts"));
```

- [ ] **Step 3 : Ajouter le script npm**

Dans `package.json`, section `scripts`, après `"test:e2e"` :

```json
    "snapshot": "node scripts/snapshot.mjs"
```

- [ ] **Step 4 : Premier relevé — montrer la sortie brute**

Run: `npm run snapshot`
Attendu (ordre de grandeur, à comparer aux mesures du 15/09 dans le spec §3) :

```
— Kiko (2026-09-15)
  auditeurs=24468 kworbDaily=— titres=5 deezerFans=— yt=— villes=5
— Dadju (2026-09-15)
  auditeurs=6481936 kworbDaily=1587902 titres=239 deezerFans=3276021 yt=— villes=5
— Nono La Grinta (2026-09-15)
  auditeurs=4731080 kworbDaily=949847 titres=54 deezerFans=289972 yt=— villes=5
index régénéré : …/src/lib/real/snapshots/index.ts
```

Si `villes=—` ou `titres=0` pour la page rendue : ouvrir la page dans le navigateur, regarder le DOM réel (`data-testid`, structure de la modale « Plus d'infos ») et adapter les sélecteurs du script — **ne pas continuer avec des `null` sans avoir essayé**. Noter dans le commit ce qui a été relevé et ce qui manque.

- [ ] **Step 5 : Vérifier le JSON et l'index**

Run: `cat src/lib/real/snapshots/dadju/*.json | head -40 && cat src/lib/real/snapshots/index.ts`
Attendu : `kworb.tracks[0]` = `{ "name": "Reine", "total": 2288…, "daily": 8…}` ; l'index exporte `SNAPSHOTS` avec les 3 ids et `LATEST_DATE = "2026-09-15"`.

- [ ] **Step 6 : Commit**

```bash
git add scripts package.json src/lib/real/snapshots && git commit -m "feat(real): script de snapshot + premier relevé du 2026-09-15 (Spotify, Kworb, Deezer, villes)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3 : Roster réel et « aujourd'hui »

**Files:**
- Modify: `src/lib/demo/seed.ts`, `src/lib/demo/data.ts`, `src/lib/role.tsx`, `src/components/dashboard/topbar.tsx:59`, `src/components/modules/algo/discovery-data.tsx:80`
- Modify tests: `src/lib/demo/__tests__/determinism.test.ts`, `forecast.test.ts`, `pnl.test.ts`

- [ ] **Step 1 : « Aujourd'hui » = dernier snapshot**

Dans `src/lib/demo/seed.ts`, remplacer :

```ts
export const DEMO_TODAY = new Date("2026-07-02T00:00:00Z");
```

par :

```ts
import { LATEST_DATE } from "@/lib/real/snapshots";

/** « Aujourd'hui » = date du dernier relevé réel : les séries restent stables entre deux snapshots. */
export const DEMO_TODAY = new Date(`${LATEST_DATE}T00:00:00Z`);
```

- [ ] **Step 2 : Remplacer le label et le roster dans `src/lib/demo/data.ts`**

Remplacer le bloc `LABEL` et tout le tableau `ARTISTS` (lignes 16–107) par :

```ts
import { SNAPSHOTS } from "@/lib/real/snapshots";

export const LABEL = {
  id: "day1-dashboard-pro",
  name: "Day 1 Dashboard Pro",
  foundedYear: 2026,
};

/** Auditeurs mensuels du dernier relevé, sinon la valeur de secours. */
function listenersFromSnapshot(artistId: string, fallback: number): number {
  const snaps = SNAPSHOTS[artistId];
  const last = snaps?.[snaps.length - 1];
  return last?.spotify.monthlyListeners ?? fallback;
}

/**
 * Le roster réel de la démo (spec §6). Les chiffres d'audience viennent des
 * snapshots ; hue, initiales, index, dates de signature sont simulés.
 */
export const ARTISTS: Artist[] = [
  {
    id: "dadju",
    name: "Dadju",
    genre: "R&B / Pop urbaine",
    hue: 285,
    initials: "DA",
    monthlyListeners: listenersFromSnapshot("dadju", 6_481_936),
    growthRate: 0.012,
    careerStage: "established",
    day1Index: 88,
    signedSince: "2017-05-19",
    dealType: "artiste",
    country: "FR",
    spotifyId: "4sbXXFzEWJY2zsZjelerjX",
    deezerId: "4803754",
    youtubeChannelId: "UC8HMvOLE0etpO_eVjJ98bHA",
  },
  {
    id: "nono-la-grinta",
    name: "Nono La Grinta",
    genre: "Rap",
    hue: 35,
    initials: "NG",
    monthlyListeners: listenersFromSnapshot("nono-la-grinta", 4_731_080),
    growthRate: 0.045,
    careerStage: "developing",
    day1Index: 74,
    signedSince: "2023-03-10",
    dealType: "artiste",
    country: "FR",
    spotifyId: "4P2HohWBtvSxxwabNDdYXN",
    deezerId: "194146027",
  },
  {
    id: "kiko",
    name: "Kiko",
    genre: "Afro-pop / Rap",
    hue: 165,
    initials: "KI",
    monthlyListeners: listenersFromSnapshot("kiko", 24_468),
    growthRate: 0.09,
    careerStage: "emerging",
    day1Index: 52,
    signedSince: "2025-01-15",
    dealType: "distribution",
    country: "TG",
    spotifyId: "4P2zZ1OLqeeKDLXc34Yfsv",
  },
];
```

- [ ] **Step 3 : Projets et titres réels**

Remplacer tout `PROJECT_SEEDS` (lignes 123–268) par les titres réellement relevés (Kworb pour Dadju et Nono, page Spotify pour Kiko). Les regroupements en projets et les dates de sortie sont **simulés** (on n'a pas la discographie) — ils servent aux pics de sortie et aux dépenses par projet :

```ts
const PROJECT_SEEDS: Record<string, ProjectSeed[]> = {
  dadju: [
    {
      id: "da-cullinan",
      title: "Cullinan",
      type: "album",
      releaseDate: "2024-11-15",
      tracks: ["Dieu merci", "Mon soleil", "Oublie-le", "Django", "Bob Marley", "Meleğim"],
    },
    {
      id: "da-poison-antidote",
      title: "Poison ou Antidote",
      type: "album",
      releaseDate: "2019-11-08",
      tracks: ["Compliqué", "Grand bain", "Par amour", "I love you", "Jaloux", "DANÇARINA - Remix"],
    },
    {
      id: "da-gentleman",
      title: "Gentleman 2.0",
      type: "album",
      releaseDate: "2017-11-24",
      tracks: ["Reine", "Jamais (feat. Dadju)"],
    },
  ],
  "nono-la-grinta": [
    {
      id: "ng-paris",
      title: "PARIS",
      type: "album",
      releaseDate: "2025-04-11",
      tracks: ["Paris", "LOVE YOU", "AVEC MOI", "TERRAIN", "FLASH-BACK", "STEPHANIE", "7AM"],
    },
    {
      id: "ng-colors",
      title: "LOVE YOU — A COLORS SHOW",
      type: "single",
      releaseDate: "2025-06-20",
      tracks: ["LOVE YOU - A COLORS SHOW"],
    },
    {
      id: "ng-grinta",
      title: "La Grinta",
      type: "ep",
      releaseDate: "2024-03-08",
      tracks: ["LA QUOI ? (feat. La Mano 1.9)", "J'tavais dit", "Délit", "Restaurant", "Audrey Kelly", "22%"],
    },
  ],
  kiko: [
    {
      id: "ki-golden-boy",
      title: "Golden Boy",
      type: "ep",
      releaseDate: "2025-11-21",
      tracks: ["Odjo", "Business class", "One in a million"],
    },
    {
      id: "ki-rayon",
      title: "Rayon de soleil",
      type: "single",
      releaseDate: "2026-05-16",
      tracks: ["Rayon de soleil"],
    },
    {
      id: "ki-ding",
      title: "Ding Deng Dong",
      type: "single",
      releaseDate: "2025-06-06",
      tracks: ["Ding Deng Dong"],
    },
  ],
};
```

Les titres doivent être **orthographiés exactement comme dans les snapshots** (`kworb.tracks[].name`, `spotify.topTracks[].name`) : c'est la clé de jointure de `real-source.ts`.

- [ ] **Step 4 : Contrats du roster**

Remplacer tout `CONTRACTS` (lignes 357–515) par trois contrats cohérents avec les `dealType` (simulés, alertes comprises) :

```ts
export const CONTRACTS: Contract[] = [
  {
    id: "c-da-artiste",
    artistId: "dadju",
    type: "licence",
    counterparty: "Label — contrat d'artiste",
    startDate: "2017-05-19",
    endDate: "2027-05-19",
    royaltyRate: 22,
    advance: 450_000,
    recoupedPct: 100,
    territory: "Monde",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "warning",
        dueDate: "2026-11-19",
        message: {
          fr: "Option de renouvellement à lever avant le 19/11 — fenêtre de renégociation ouverte",
          en: "Renewal option to exercise before Nov 19 — renegotiation window open",
        },
      },
      {
        kind: "audit-window",
        severity: "info",
        dueDate: "2026-12-31",
        message: {
          fr: "Fenêtre d'audit contractuelle : exercice 2025 auditable jusqu'au 31/12",
          en: "Contractual audit window: FY2025 auditable until Dec 31",
        },
      },
    ],
  },
  {
    id: "c-ng-artiste",
    artistId: "nono-la-grinta",
    type: "licence",
    counterparty: "Label — contrat d'artiste",
    startDate: "2023-03-10",
    endDate: "2027-03-10",
    royaltyRate: 20,
    advance: 90_000,
    recoupedPct: 71,
    territory: "Monde",
    exclusive: true,
    alerts: [
      {
        kind: "unusual-clause",
        severity: "danger",
        message: {
          fr: "Clause de recoupement croisé sur les revenus live — à faire retirer au prochain avenant",
          en: "Cross-collateralization clause on live revenue — to remove at next amendment",
        },
      },
    ],
  },
  {
    id: "c-ki-distribution",
    artistId: "kiko",
    type: "distribution",
    counterparty: "Distributeur numérique",
    startDate: "2025-01-15",
    endDate: "2027-01-15",
    royaltyRate: 85,
    advance: 0,
    recoupedPct: 100,
    territory: "Monde",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "info",
        dueDate: "2027-01-15",
        message: {
          fr: "Contrat de distribution : préavis de résiliation 90 jours avant échéance",
          en: "Distribution deal: 90-day termination notice before expiry",
        },
      },
    ],
  },
];
```

- [ ] **Step 5 : Accès équipe et repli des démos**

Dans `TEAM`, remplacer `artistAccess: ["sky-lune", "mira-sol"]` par `artistAccess: ["nono-la-grinta", "kiko"]`.

Dans `src/lib/role.tsx`, remplacer `export const DEMO_ARTIST_ID = "sky-lune";` par `export const DEMO_ARTIST_ID = "dadju";`.

Dans `src/components/dashboard/topbar.tsx` ligne 59, remplacer `"sky-lune"` par `DEMO_ARTIST_ID` et ajouter l'import `import { DEMO_ARTIST_ID, useRole } from "@/lib/role";` (fusionner avec l'import `useRole` existant).

Dans `src/components/modules/algo/discovery-data.tsx`, renommer la clé `"sky-lune"` du dictionnaire `DEMOS` en `"dadju"` et remplacer ligne 80 `DEMOS[artistId] ?? DEMOS["sky-lune"]` par `DEMOS[artistId] ?? DEMOS["dadju"]`.

- [ ] **Step 6 : Adapter les tests qui nomment l'ancien roster**

`src/lib/demo/__tests__/determinism.test.ts` lignes 37–38 : `"sky-lune"` → `"dadju"`.
`src/lib/demo/__tests__/forecast.test.ts` : `"sky-lune"` → `"dadju"`, `"vela"` → `"kiko"`, `"kayro"` → `"nono-la-grinta"`.
`src/lib/demo/__tests__/pnl.test.ts` ligne 65 : `"kayro"` → `"nono-la-grinta"`.

Run: `grep -rn "sky-lune\|kayro\|vela\|mira-sol\|leon-brume\|orka\|Nocturne" src --include=*.ts --include=*.tsx`
Attendu : aucune ligne (sauf éventuels textes i18n traités à l'étape suivante).

- [ ] **Step 7 : Textes i18n qui citaient Nocturne**

Run: `grep -rn "Nocturne" src/messages`
Pour chaque occurrence (ex. `pulse.json` → `"artistsHint": "signés chez Nocturne"`), remplacer par une formulation neutre : fr `"au roster"`, en `"on the roster"`.

- [ ] **Step 8 : Tests, types, lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Attendu : tous verts (le nombre de tests baisse : `it.each(ARTIST_IDS)` tourne sur 3 artistes au lieu de 6).

- [ ] **Step 9 : Vérifier visuellement que rien n'explose à 3 artistes**

Run: `npm run dev` puis ouvrir `/roster`, `/pulse` (vue label et vue artiste), `/comparatif`, `/finances`. Attendu : les pages se rendent avec Dadju / Nono / Kiko ; les auditeurs mensuels de Pulse affichent les valeurs du snapshot. Les streams sont encore synthétiques (normal, Task 6 les branche).

- [ ] **Step 10 : Commit**

```bash
git add -A src && git commit -m "feat(roster): Day 1 Dashboard Pro — roster réel Dadju / Nono La Grinta / Kiko, aujourd'hui = dernier snapshot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4 : Reconstruction déterministe de l'historique (§4.3)

**Files:**
- Create: `src/lib/real/reconstruct.ts`
- Test: `src/lib/real/__tests__/reconstruct.test.ts`

- [ ] **Step 1 : Écrire les tests**

`src/lib/real/__tests__/reconstruct.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { reconstructTrack } from "@/lib/real/reconstruct";

const TODAY = new Date("2026-09-15T00:00:00Z");

describe("reconstructTrack", () => {
  it("est déterministe", () => {
    const a = reconstructTrack({ key: "dadju:Reine", total: 228_869_436, dailyNow: 82_112, days: 365, today: TODAY });
    const b = reconstructTrack({ key: "dadju:Reine", total: 228_869_436, dailyNow: 82_112, days: 365, today: TODAY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rend exactement `days` points, datés jusqu'à aujourd'hui, tous ≥ 0", () => {
    const s = reconstructTrack({ key: "x", total: 1_000_000, dailyNow: 3_000, days: 90, today: TODAY });
    expect(s).toHaveLength(90);
    expect(s[s.length - 1].date).toBe("2026-09-15");
    expect(s[0].date).toBe("2026-06-18");
    for (const p of s) expect(p.streams).toBeGreaterThanOrEqual(0);
  });

  it("le dernier jour est ancré sur le débit relevé, et marqué mesuré", () => {
    const s = reconstructTrack({ key: "x", total: 1_000_000, dailyNow: 3_000, days: 30, today: TODAY });
    expect(s[s.length - 1].streams).toBe(3_000);
    expect(s[s.length - 1].provenance).toBe("measured");
    expect(s[0].provenance).toBe("reconstructed");
  });

  it("ne dépasse jamais le total cumulé", () => {
    // Titre récent : 3 000/j sur 365 j ferait 1,1 M > total 400 k.
    const s = reconstructTrack({ key: "y", total: 400_000, dailyNow: 3_000, days: 365, today: TODAY });
    expect(s.reduce((acc, p) => acc + p.streams, 0)).toBeLessThanOrEqual(400_000);
  });

  it("un titre sorti dans la fenêtre est à zéro avant sa sortie et somme ≈ total", () => {
    const s = reconstructTrack({
      key: "z", total: 500_000, dailyNow: 2_000, days: 365, today: TODAY, releaseDate: "2026-07-01",
    });
    expect(s.filter((p) => p.date < "2026-07-01").every((p) => p.streams === 0)).toBe(true);
    const sum = s.reduce((acc, p) => acc + p.streams, 0);
    expect(sum).toBeGreaterThan(500_000 * 0.97);
    expect(sum).toBeLessThanOrEqual(500_000);
  });

  it("les jours mesurés fournis remplacent la reconstruction", () => {
    const s = reconstructTrack({
      key: "m", total: 1_000_000, dailyNow: 3_000, days: 10, today: TODAY,
      measured: { "2026-09-13": 2_500, "2026-09-14": 2_800 },
    });
    const d13 = s.find((p) => p.date === "2026-09-13")!;
    expect(d13.streams).toBe(2_500);
    expect(d13.provenance).toBe("measured");
  });

  it("la saisonnalité hebdo est visible : vendredi > lundi en moyenne", () => {
    const s = reconstructTrack({ key: "w", total: 50_000_000, dailyNow: 10_000, days: 364, today: TODAY });
    const avg = (dow: number) => {
      const xs = s.filter((p) => new Date(`${p.date}T00:00:00Z`).getUTCDay() === dow);
      return xs.reduce((a, p) => a + p.streams, 0) / xs.length;
    };
    expect(avg(5)).toBeGreaterThan(avg(1));
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/real/__tests__/reconstruct.test.ts`
Attendu : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `src/lib/real/reconstruct.ts`**

```ts
/**
 * Reconstitution déterministe d'un historique quotidien par titre (spec §4.3).
 * On connaît : le total cumulé T, le débit du jour d, parfois la date de sortie,
 * parfois des jours réellement mesurés. On produit `days` points, ancrés sur d,
 * avec saisonnalité hebdo et bruit seedé, sans jamais dépasser T.
 */
import { isoDay, rngFor } from "@/lib/demo/seed";
import { RECONSTRUCT } from "./params";
import type { Provenance } from "./types";

export type ReconstructedDay = { date: string; streams: number; provenance: Provenance };

export type ReconstructInput = {
  /** Clé de seed stable, ex. "dadju:Reine". */
  key: string;
  total: number;
  dailyNow: number;
  days: number;
  today: Date;
  releaseDate?: string;
  /** Jours réellement mesurés (date → streams) : ils remplacent la reconstruction. */
  measured?: Record<string, number>;
};

function weeklyFactor(dow: number): number {
  const w = RECONSTRUCT.weekly;
  return dow === 5 ? w.fri : dow === 6 ? w.sat : dow === 0 ? w.sun : dow === 1 ? w.mon : w.other;
}

function dayBefore(today: Date, n: number): Date {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function reconstructTrack(input: ReconstructInput): ReconstructedDay[] {
  const { key, total, dailyNow, days, today, releaseDate, measured = {} } = input;
  const rand = rngFor(`reconstruct:${key}`);
  const todayIso = isoDay(today);
  const release = releaseDate ? new Date(`${releaseDate}T00:00:00Z`) : null;

  // 1. Forme brute : débit constant × hebdo × bruit, pic de sortie si connu.
  const raw: Array<{ date: string; value: number; dow: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayBefore(today, i);
    const iso = isoDay(d);
    const noise = 1 + (rand() * 2 - 1) * RECONSTRUCT.noiseAmplitude;
    let value = dailyNow * weeklyFactor(d.getUTCDay()) * noise;
    if (release) {
      const age = (d.getTime() - release.getTime()) / 86_400_000;
      if (age < 0) value = 0;
      else value *= 1 + RECONSTRUCT.releaseSpike * Math.exp(-age / RECONSTRUCT.releaseDecayDays);
    }
    raw.push({ date: iso, value, dow: d.getUTCDay() });
  }

  // 2. Le dernier jour est le débit relevé, tel quel.
  raw[raw.length - 1].value = dailyNow;

  // 3. Contrainte de somme : jamais plus que le total cumulé. Si le titre est
  //    sorti dans la fenêtre, sa somme doit approcher le total (tout son
  //    historique est dans la fenêtre) ; sinon on plafonne à 95 % du total.
  const sum = raw.reduce((s, p) => s + p.value, 0);
  const inWindow = release !== null && release.getTime() >= dayBefore(today, days - 1).getTime();
  const cap = inWindow ? total : total * 0.95;
  const scale = sum > cap ? cap / sum : inWindow ? cap / sum : 1;
  // Le dernier jour reste ancré ; on répartit l'ajustement sur les autres.
  const others = sum - dailyNow;
  const targetOthers = Math.max(0, cap * (scale === 1 ? sum / cap : 1) - dailyNow);
  const otherScale = others > 0 ? Math.min(targetOthers / others, scale === 1 ? 1 : Infinity) : 1;

  const out: ReconstructedDay[] = raw.map((p, idx) => {
    const isLast = idx === raw.length - 1;
    const streams = isLast ? Math.round(dailyNow) : Math.round(p.value * (scale === 1 ? 1 : otherScale));
    return { date: p.date, streams, provenance: isLast ? "measured" : "reconstructed" };
  });

  // 4. Jours mesurés fournis : ils remplacent.
  for (const p of out) {
    if (p.date in measured && p.date !== todayIso) {
      p.streams = Math.round(measured[p.date]);
      p.provenance = "measured";
    }
  }
  // Garde-fou final sur la somme (les jours mesurés peuvent la faire dépasser).
  const finalSum = out.reduce((s, p) => s + p.streams, 0);
  if (finalSum > total) {
    const excess = finalSum - total;
    const adjustable = out.filter((p) => p.provenance === "reconstructed");
    const adjSum = adjustable.reduce((s, p) => s + p.streams, 0);
    if (adjSum > 0) {
      for (const p of adjustable) p.streams = Math.max(0, Math.round(p.streams - (excess * p.streams) / adjSum));
    }
  }
  return out;
}
```

- [ ] **Step 4 : Lancer, itérer jusqu'au vert**

Run: `npx vitest run src/lib/real/__tests__/reconstruct.test.ts`
Attendu : 7 tests PASS. Si « ne dépasse jamais le total » ou « somme ≈ total » échoue, c'est le calcul de `otherScale` : simplifier en `otherScale = (cap - dailyNow) / others` quand `sum > cap` ou `inWindow`, et `1` sinon — l'intention est : le dernier jour vaut `dailyNow`, les autres jours sont mis à l'échelle pour que la somme vaille `cap`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/real/reconstruct.ts src/lib/real/__tests__/reconstruct.test.ts && git commit -m "feat(real): reconstruction déterministe de l'historique par titre

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5 : Mix DSP par artiste et territoire (§5.1 pt 4, §5.2)

**Files:**
- Create: `src/lib/real/dsp-mix.ts`, `src/lib/real/territory.ts`
- Test: `src/lib/real/__tests__/dsp-mix.test.ts`, `src/lib/real/__tests__/territory.test.ts`

- [ ] **Step 1 : Tests du mix**

`src/lib/real/__tests__/dsp-mix.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { artistMix, deezerWeight } from "@/lib/real/dsp-mix";
import { MARKET_MIX_FR } from "@/lib/real/params";

describe("artistMix", () => {
  it("sans signal Deezer, renvoie le mix de marché", () => {
    expect(artistMix({ deezerFans: null, spotifyMonthlyListeners: 1_000_000 })).toEqual(MARKET_MIX_FR);
  });

  it("Dadju (3,28 M fans / 6,48 M auditeurs) : part Deezer relevée, somme = 1", () => {
    const m = artistMix({ deezerFans: 3_276_021, spotifyMonthlyListeners: 6_481_936 });
    expect(m.deezer).toBeGreaterThan(MARKET_MIX_FR.deezer);
    expect(Object.values(m).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
  });

  it("un ratio très faible est borné à ×0,5", () => {
    const m = artistMix({ deezerFans: 10, spotifyMonthlyListeners: 1_000_000 });
    expect(m.deezer / MARKET_MIX_FR.deezer).toBeGreaterThan(0.45);
  });
});

describe("deezerWeight", () => {
  it("un artiste pro pèse entre 1,5 et 2 fois le stream Deezer moyen", () => {
    const w = deezerWeight({ pro: true });
    expect(w).toBeGreaterThan(1.5);
    expect(w).toBeLessThan(2);
  });
  it("un artiste non pro pèse moins que la moyenne", () => {
    expect(deezerWeight({ pro: false })).toBeLessThan(1);
  });
});
```

- [ ] **Step 2 : Tests du territoire**

`src/lib/real/__tests__/territory.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  countriesFromCities,
  territoryCoefficient,
  zoneDistribution,
  zoneOfCountry,
} from "@/lib/real/territory";

describe("territoire", () => {
  it("classe les pays par zone", () => {
    expect(zoneOfCountry("FR")).toBe("frbech");
    expect(zoneOfCountry("BE")).toBe("frbech");
    expect(zoneOfCountry("DE")).toBe("europe");
    expect(zoneOfCountry("US")).toBe("northAmerica");
    expect(zoneOfCountry("CI")).toBe("africa");
    expect(zoneOfCountry("JP")).toBe("rest");
  });

  it("sans villes, utilise la répartition par défaut du pays de l'artiste", () => {
    const fr = zoneDistribution(null, "FR");
    const tg = zoneDistribution(null, "TG");
    expect(fr.frbech).toBeGreaterThan(tg.frbech);
    expect(tg.africa).toBeGreaterThan(fr.africa);
  });

  it("avec des villes, pondère par les auditeurs et somme à 1", () => {
    const dist = zoneDistribution(
      [
        { city: "Paris", country: "France", listeners: 500_000 },
        { city: "Abidjan", country: "Côte d'Ivoire", listeners: 300_000 },
        { city: "Bruxelles", country: "Belgique", listeners: 200_000 },
      ],
      "FR",
    );
    expect(dist.frbech).toBeCloseTo(0.7, 6);
    expect(dist.africa).toBeCloseTo(0.3, 6);
    expect(Object.values(dist).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
  });

  it("le coefficient d'un artiste à audience africaine est nettement plus bas", () => {
    const fr = territoryCoefficient(zoneDistribution(null, "FR"));
    const tg = territoryCoefficient(zoneDistribution(null, "TG"));
    expect(tg).toBeLessThan(fr * 0.75);
  });

  it("countriesFromCities renvoie des CountryStreams iso3 triés", () => {
    const rows = countriesFromCities(
      [
        { city: "Paris", country: "France", listeners: 500_000 },
        { city: "Lyon", country: "France", listeners: 100_000 },
        { city: "Abidjan", country: "Côte d'Ivoire", listeners: 300_000 },
      ],
      1_000_000,
    );
    expect(rows[0]).toMatchObject({ iso3: "FRA", nameFr: "France" });
    expect(rows[0].streams).toBeGreaterThan(rows[1].streams);
    expect(rows.reduce((s, r) => s + r.streams, 0)).toBe(1_000_000);
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/real/__tests__/dsp-mix.test.ts src/lib/real/__tests__/territory.test.ts`
Attendu : FAIL — modules introuvables.

- [ ] **Step 4 : Implémenter `src/lib/real/dsp-mix.ts`**

```ts
/** Mix DSP France corrigé par artiste (spec §5.2) et poids Deezer artist-centric. */
import type { DSP } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import {
  DEEZER_ARTIST_CENTRIC,
  DEEZER_RATIO_CLAMP,
  DEEZER_RATIO_MEDIAN,
  MARKET_MIX_FR,
} from "./params";

export type MixInput = { deezerFans: number | null; spotifyMonthlyListeners: number };

export function artistMix(input: MixInput): Record<DSP, number> {
  if (input.deezerFans === null || input.spotifyMonthlyListeners <= 0) return { ...MARKET_MIX_FR };
  const r = input.deezerFans / input.spotifyMonthlyListeners;
  const factor = Math.min(DEEZER_RATIO_CLAMP[1], Math.max(DEEZER_RATIO_CLAMP[0], r / DEEZER_RATIO_MEDIAN));
  const raw: Record<DSP, number> = { ...MARKET_MIX_FR, deezer: MARKET_MIX_FR.deezer * factor };
  const sum = DSPS.reduce((s, d) => s + raw[d], 0);
  const out = {} as Record<DSP, number>;
  for (const d of DSPS) out[d] = raw[d] / sum;
  return out;
}

/** Poids d'un stream Deezer de l'artiste relativement au stream Deezer moyen. */
export function deezerWeight(opts: { pro: boolean; activeShare?: number }): number {
  const { proBoost, activeBoost, activeShareDefault, averageWeight } = DEEZER_ARTIST_CENTRIC;
  const active = opts.activeShare ?? activeShareDefault;
  const own = (opts.pro ? proBoost : 1) * (active * activeBoost + (1 - active));
  return own / averageWeight;
}

export function isDeezerPro(opts: { monthlyStreams: number; monthlyListeners: number }): boolean {
  const t = DEEZER_ARTIST_CENTRIC.proThreshold;
  return opts.monthlyStreams >= t.streamsPerMonth && opts.monthlyListeners >= t.uniqueListeners;
}
```

- [ ] **Step 5 : Implémenter `src/lib/real/territory.ts`**

```ts
/** Villes d'écoute → zones → coefficient territorial ; villes → pays pour la carte (spec §5.1 pt 4). */
import type { CountryStreams } from "@/lib/demo/types";
import { TERRITORY_COEF, ZONE_DEFAULTS, ZONES, type Zone } from "./params";
import type { SnapshotCity } from "./types";

type CountryDef = { iso2: string; iso3: string; nameFr: string; nameEn: string; zone: Zone };

/** Pays reconnus dans les libellés Spotify (fr/en). Inconnu → "rest". */
const COUNTRIES: CountryDef[] = [
  { iso2: "FR", iso3: "FRA", nameFr: "France", nameEn: "France", zone: "frbech" },
  { iso2: "BE", iso3: "BEL", nameFr: "Belgique", nameEn: "Belgium", zone: "frbech" },
  { iso2: "CH", iso3: "CHE", nameFr: "Suisse", nameEn: "Switzerland", zone: "frbech" },
  { iso2: "LU", iso3: "LUX", nameFr: "Luxembourg", nameEn: "Luxembourg", zone: "frbech" },
  { iso2: "DE", iso3: "DEU", nameFr: "Allemagne", nameEn: "Germany", zone: "europe" },
  { iso2: "GB", iso3: "GBR", nameFr: "Royaume-Uni", nameEn: "United Kingdom", zone: "europe" },
  { iso2: "ES", iso3: "ESP", nameFr: "Espagne", nameEn: "Spain", zone: "europe" },
  { iso2: "IT", iso3: "ITA", nameFr: "Italie", nameEn: "Italy", zone: "europe" },
  { iso2: "NL", iso3: "NLD", nameFr: "Pays-Bas", nameEn: "Netherlands", zone: "europe" },
  { iso2: "PT", iso3: "PRT", nameFr: "Portugal", nameEn: "Portugal", zone: "europe" },
  { iso2: "TR", iso3: "TUR", nameFr: "Turquie", nameEn: "Turkey", zone: "europe" },
  { iso2: "US", iso3: "USA", nameFr: "États-Unis", nameEn: "United States", zone: "northAmerica" },
  { iso2: "CA", iso3: "CAN", nameFr: "Canada", nameEn: "Canada", zone: "northAmerica" },
  { iso2: "CI", iso3: "CIV", nameFr: "Côte d'Ivoire", nameEn: "Ivory Coast", zone: "africa" },
  { iso2: "SN", iso3: "SEN", nameFr: "Sénégal", nameEn: "Senegal", zone: "africa" },
  { iso2: "CM", iso3: "CMR", nameFr: "Cameroun", nameEn: "Cameroon", zone: "africa" },
  { iso2: "TG", iso3: "TGO", nameFr: "Togo", nameEn: "Togo", zone: "africa" },
  { iso2: "BJ", iso3: "BEN", nameFr: "Bénin", nameEn: "Benin", zone: "africa" },
  { iso2: "MA", iso3: "MAR", nameFr: "Maroc", nameEn: "Morocco", zone: "africa" },
  { iso2: "DZ", iso3: "DZA", nameFr: "Algérie", nameEn: "Algeria", zone: "africa" },
  { iso2: "TN", iso3: "TUN", nameFr: "Tunisie", nameEn: "Tunisia", zone: "africa" },
  { iso2: "CD", iso3: "COD", nameFr: "RD Congo", nameEn: "DR Congo", zone: "africa" },
  { iso2: "GA", iso3: "GAB", nameFr: "Gabon", nameEn: "Gabon", zone: "africa" },
  { iso2: "ML", iso3: "MLI", nameFr: "Mali", nameEn: "Mali", zone: "africa" },
  { iso2: "BF", iso3: "BFA", nameFr: "Burkina Faso", nameEn: "Burkina Faso", zone: "africa" },
  { iso2: "GN", iso3: "GIN", nameFr: "Guinée", nameEn: "Guinea", zone: "africa" },
  { iso2: "MG", iso3: "MDG", nameFr: "Madagascar", nameEn: "Madagascar", zone: "africa" },
  { iso2: "RE", iso3: "REU", nameFr: "La Réunion", nameEn: "Réunion", zone: "frbech" },
  { iso2: "GP", iso3: "GLP", nameFr: "Guadeloupe", nameEn: "Guadeloupe", zone: "frbech" },
  { iso2: "MQ", iso3: "MTQ", nameFr: "Martinique", nameEn: "Martinique", zone: "frbech" },
  { iso2: "HT", iso3: "HTI", nameFr: "Haïti", nameEn: "Haiti", zone: "rest" },
  { iso2: "BR", iso3: "BRA", nameFr: "Brésil", nameEn: "Brazil", zone: "rest" },
  { iso2: "JP", iso3: "JPN", nameFr: "Japon", nameEn: "Japan", zone: "rest" },
  { iso2: "AU", iso3: "AUS", nameFr: "Australie", nameEn: "Australia", zone: "rest" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Accepte un code ISO2 ou un nom (fr/en) tel qu'affiché par Spotify. */
export function findCountry(label: string): CountryDef | null {
  const n = norm(label);
  return (
    COUNTRIES.find((c) => norm(c.iso2) === n) ??
    COUNTRIES.find((c) => norm(c.nameFr) === n || norm(c.nameEn) === n) ??
    null
  );
}

export function zoneOfCountry(label: string): Zone {
  return findCountry(label)?.zone ?? "rest";
}

export function zoneDistribution(cities: SnapshotCity[] | null, artistCountry: string): Record<Zone, number> {
  if (!cities || cities.length === 0) {
    return { ...(ZONE_DEFAULTS[artistCountry] ?? ZONE_DEFAULTS.default) };
  }
  const acc = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<Zone, number>;
  let total = 0;
  for (const c of cities) {
    acc[zoneOfCountry(c.country)] += c.listeners;
    total += c.listeners;
  }
  for (const z of ZONES) acc[z] = total > 0 ? acc[z] / total : 0;
  return acc;
}

export function territoryCoefficient(dist: Record<Zone, number>): number {
  return ZONES.reduce((s, z) => s + dist[z] * TERRITORY_COEF[z], 0);
}

/** Répartit `totalStreams` entre pays au prorata des auditeurs des villes (carte du monde). */
export function countriesFromCities(cities: SnapshotCity[], totalStreams: number): CountryStreams[] {
  const byCountry = new Map<string, { def: CountryDef; listeners: number }>();
  for (const c of cities) {
    const def = findCountry(c.country);
    if (!def) continue;
    const cur = byCountry.get(def.iso3) ?? { def, listeners: 0 };
    cur.listeners += c.listeners;
    byCountry.set(def.iso3, cur);
  }
  const total = Array.from(byCountry.values()).reduce((s, v) => s + v.listeners, 0) || 1;
  const rows = Array.from(byCountry.values())
    .map(({ def, listeners }) => ({
      iso3: def.iso3,
      nameFr: def.nameFr,
      nameEn: def.nameEn,
      streams: Math.round((listeners / total) * totalStreams),
    }))
    .sort((a, b) => b.streams - a.streams);
  // Arrondi : on absorbe l'écart sur le premier pays pour que la somme soit exacte.
  const diff = totalStreams - rows.reduce((s, r) => s + r.streams, 0);
  if (rows[0]) rows[0].streams += diff;
  return rows;
}
```

- [ ] **Step 6 : Lancer, vérifier le vert**

Run: `npx vitest run src/lib/real/__tests__/dsp-mix.test.ts src/lib/real/__tests__/territory.test.ts`
Attendu : 10 tests PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/real/dsp-mix.ts src/lib/real/territory.ts src/lib/real/__tests__ && git commit -m "feat(real): mix DSP corrigé par artiste (Deezer artist-centric) et pondération territoriale

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6 : Estimateur « stream rémunérateur » (§5.1)

**Files:**
- Create: `src/lib/real/estimator.ts`
- Test: `src/lib/real/__tests__/estimator.test.ts`

- [ ] **Step 1 : Tests**

`src/lib/real/__tests__/estimator.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  artistShare,
  confidenceOf,
  estimateDay,
  publishingShare,
  summarize,
  type DayInput,
} from "@/lib/real/estimator";
import { RATE_FR, TIER_FR, blendedRate } from "@/lib/real/params";

const base: DayInput = {
  date: "2026-09-15",
  byDsp: { spotify: { streams: 1_000_000, provenance: "measured" } },
  territoryCoef: 1,
  tier: TIER_FR,
  deezerPro: true,
  payableShare: 1,
};

describe("estimateDay", () => {
  it("1 M de streams Spotify en France ≈ 1 M × taux mixé × 0,85, en fourchette ordonnée", () => {
    const e = estimateDay(base);
    const expected = 1_000_000 * blendedRate(TIER_FR) * 0.85;
    expect(e.grossMaster.mid).toBeCloseTo(expected, 0);
    expect(e.grossMaster.low).toBeLessThan(e.grossMaster.mid);
    expect(e.grossMaster.high).toBeGreaterThan(e.grossMaster.mid);
    expect(e.streams).toBe(1_000_000);
    expect(e.payableStreams).toBe(1_000_000);
  });

  it("le territoire divise le brut (Afrique)", () => {
    const fr = estimateDay(base).grossMaster.mid;
    const tg = estimateDay({ ...base, territoryCoef: 0.5 }).grossMaster.mid;
    expect(tg).toBeCloseTo(fr / 2, 0);
  });

  it("un stream Deezer d'un artiste pro vaut plus qu'un stream Spotify", () => {
    const e = estimateDay({
      ...base,
      byDsp: {
        spotify: { streams: 1_000, provenance: "measured" },
        deezer: { streams: 1_000, provenance: "estimated" },
      },
    });
    expect(e.byDsp.deezer!.gross.mid).toBeGreaterThan(e.byDsp.spotify!.gross.mid * 1.5);
  });

  it("les streams non rémunérables ne rapportent rien", () => {
    const e = estimateDay({ ...base, payableShare: 0.5 });
    expect(e.payableStreams).toBe(500_000);
    expect(e.grossMaster.mid).toBeCloseTo(estimateDay(base).grossMaster.mid / 2, 0);
  });

  it("un taux calibré remplace le taux par défaut", () => {
    const e = estimateDay({ ...base, rateOverrides: { spotify: 0.0031 } });
    expect(e.byDsp.spotify!.gross.mid).toBeCloseTo(1_000_000 * 0.0031, 0);
    expect(e.byDsp.spotify!.gross.low).toBeCloseTo(1_000_000 * 0.0031 * 0.95, 0);
  });

  it("la provenance du jour est la plus faible des DSP", () => {
    const e = estimateDay({
      ...base,
      byDsp: {
        spotify: { streams: 10, provenance: "measured" },
        apple: { streams: 10, provenance: "estimated" },
      },
    });
    expect(e.provenance).toBe("estimated");
  });

  it("TikTok ne génère pas de brut master", () => {
    const e = estimateDay({ ...base, byDsp: { tiktok: { streams: 1_000_000, provenance: "estimated" } } });
    expect(e.grossMaster.mid).toBe(0);
  });
});

describe("summarize / confiance / cascades", () => {
  const days = Array.from({ length: 10 }, (_, i) =>
    estimateDay({ ...base, date: `2026-09-${String(6 + i).padStart(2, "0")}` }),
  );

  it("somme les jours et garde les bornes", () => {
    const s = summarize(days, "week", { calibrated: false, dealType: "artiste" });
    expect(s.streams).toBe(7 * 1_000_000);
    expect(s.from).toBe("2026-09-09");
    expect(s.to).toBe("2026-09-15");
    expect(s.grossMaster.mid).toBeCloseTo(days[0].grossMaster.mid * 7, 0);
    expect(s.artistShare.mid).toBeCloseTo(s.grossMaster.mid * 0.2, 0);
    expect(s.publishing.mid).toBeCloseTo(s.grossMaster.mid * 0.15 * 0.5, 0);
  });

  it("confiance : mesuré + calibré = élevé ; reconstitué + défaut = indicatif", () => {
    expect(confidenceOf("measured", true)).toBe("high");
    expect(confidenceOf("measured", false)).toBe("medium");
    expect(confidenceOf("reconstructed", true)).toBe("medium");
    expect(confidenceOf("reconstructed", false)).toBe("indicative");
    expect(confidenceOf("estimated", false)).toBe("indicative");
  });

  it("cascades en fourchette", () => {
    const g = { low: 900, mid: 1000, high: 1100 };
    expect(artistShare(g, "distribution").mid).toBeCloseTo(900, 6);
    expect(artistShare(g, "indé")).toEqual(g);
    expect(publishingShare(g).mid).toBeCloseTo(75, 6);
  });

  it("le taux premium SNEP reste la référence (sanity)", () => {
    expect(RATE_FR.premium * 1_000_000).toBeGreaterThan(4_000);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/real/__tests__/estimator.test.ts`
Attendu : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `src/lib/real/estimator.ts`**

```ts
/**
 * Estimateur « stream rémunérateur » (spec §5.1).
 *   € brut master = streams_rémunérateurs × taux(DSP, territoire, tier)
 * Tout est en fourchette basse / centrale / haute, avec une provenance.
 */
import type { Artist, DSP } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import { deezerWeight } from "./dsp-mix";
import {
  AUTHOR_SHARE_OF_PUBLISHING,
  DEAL_SHARE,
  DSP_COEF,
  PUBLISHING_SHARE_OF_DSP,
  YOUTUBE_COEF,
  blendedRate,
  type Tier,
} from "./params";
import type { Confidence, DailyEstimate, EstimatePeriod, EstimateSummary, Provenance, Range } from "./types";

export type DayInput = {
  date: string;
  byDsp: Partial<Record<DSP, { streams: number; provenance: Provenance; youtubeTopicShare?: number }>>;
  /** Σ part de zone × coefficient de zone (territory.ts). */
  territoryCoef: number;
  tier: Tier;
  deezerPro: boolean;
  /** Part des streams qui passent les filtres de rémunérabilité (0-1). */
  payableShare: number;
  /** Taux € / stream calibrés par relevé, par DSP — remplacent les coefficients. */
  rateOverrides?: Partial<Record<DSP, number>>;
};

const PROVENANCE_RANK: Record<Provenance, number> = {
  measured: 0,
  reconstructed: 1,
  estimated: 2,
  simulated: 3,
};

export function weakest(ps: Provenance[]): Provenance {
  return ps.reduce<Provenance>((w, p) => (PROVENANCE_RANK[p] > PROVENANCE_RANK[w] ? p : w), "measured");
}

const scaleRange = (r: Range, k: number): Range => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });
const addRange = (a: Range, b: Range): Range => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const ZERO: Range = { low: 0, mid: 0, high: 0 };

function coefFor(dsp: DSP, youtubeTopicShare: number | undefined): Range {
  if (dsp === "youtube" && youtubeTopicShare !== undefined) {
    const t = youtubeTopicShare;
    const o = YOUTUBE_COEF.official;
    const p = YOUTUBE_COEF.topic;
    return { low: o.low * (1 - t) + p.low * t, mid: o.mid * (1 - t) + p.mid * t, high: o.high * (1 - t) + p.high * t };
  }
  return DSP_COEF[dsp];
}

export function estimateDay(input: DayInput): DailyEstimate {
  const base = blendedRate(input.tier) * input.territoryCoef;
  const byDsp: DailyEstimate["byDsp"] = {};
  let streams = 0;
  let payable = 0;
  let gross: Range = ZERO;
  const provenances: Provenance[] = [];

  for (const dsp of DSPS) {
    const d = input.byDsp[dsp];
    if (!d) continue;
    const payableStreams = d.streams * input.payableShare;
    streams += d.streams;
    payable += payableStreams;
    provenances.push(d.provenance);

    let g: Range;
    const override = input.rateOverrides?.[dsp];
    if (override !== undefined) {
      g = { low: payableStreams * override * 0.95, mid: payableStreams * override, high: payableStreams * override * 1.05 };
    } else {
      const c = coefFor(dsp, d.youtubeTopicShare);
      const w = dsp === "deezer" ? deezerWeight({ pro: input.deezerPro }) : 1;
      g = scaleRange({ low: c.low, mid: c.mid, high: c.high }, payableStreams * base * w);
    }
    byDsp[dsp] = { streams: d.streams, gross: g, provenance: d.provenance };
    gross = addRange(gross, g);
  }

  return {
    date: input.date,
    streams: Math.round(streams),
    payableStreams: Math.round(payable),
    byDsp,
    grossMaster: gross,
    provenance: provenances.length ? weakest(provenances) : "simulated",
  };
}

export function confidenceOf(provenance: Provenance, calibrated: boolean): Confidence {
  if (provenance === "measured") return calibrated ? "high" : "medium";
  if (provenance === "reconstructed") return calibrated ? "medium" : "indicative";
  return "indicative";
}

export function artistShare(gross: Range, dealType: Artist["dealType"]): Range {
  const s = DEAL_SHARE[dealType];
  return { low: gross.low * s.low, mid: gross.mid * s.mid, high: gross.high * s.high };
}

export function publishingShare(gross: Range): Range {
  return scaleRange(gross, PUBLISHING_SHARE_OF_DSP * AUTHOR_SHARE_OF_PUBLISHING);
}

const PERIOD_DAYS: Record<EstimatePeriod, number> = { day: 1, week: 7, month: 30, year: 365 };

/** Agrège les `n` derniers jours d'une série d'estimations quotidiennes (triée par date). */
export function summarize(
  days: DailyEstimate[],
  period: EstimatePeriod,
  opts: { calibrated: boolean; dealType: Artist["dealType"] },
): EstimateSummary {
  const slice = days.slice(-PERIOD_DAYS[period]);
  const gross = slice.reduce((acc, d) => addRange(acc, d.grossMaster), ZERO);
  const provenance = slice.length ? weakest(slice.map((d) => d.provenance)) : "simulated";
  return {
    period,
    from: slice[0]?.date ?? "",
    to: slice[slice.length - 1]?.date ?? "",
    streams: slice.reduce((s, d) => s + d.streams, 0),
    payableStreams: slice.reduce((s, d) => s + d.payableStreams, 0),
    grossMaster: gross,
    artistShare: artistShare(gross, opts.dealType),
    publishing: publishingShare(gross),
    confidence: confidenceOf(provenance, opts.calibrated),
    provenance,
    calibrated: opts.calibrated,
  };
}
```

- [ ] **Step 4 : Lancer, vérifier le vert**

Run: `npx vitest run src/lib/real/__tests__/estimator.test.ts`
Attendu : 11 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/real/estimator.ts src/lib/real/__tests__/estimator.test.ts && git commit -m "feat(real): estimateur stream rémunérateur — fourchettes, confiance, cascades master et édition

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7 : Calibration par relevé et écart d'audit (§5.3, §5.4)

**Files:**
- Create: `src/lib/real/calibration.ts`, `src/lib/real/audit-gap.ts`
- Test: `src/lib/real/__tests__/calibration.test.ts`, `src/lib/real/__tests__/audit-gap.test.ts`

- [ ] **Step 1 : Tests calibration**

`src/lib/real/__tests__/calibration.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { calibrationFromUserData } from "@/lib/real/calibration";
import type { UserData } from "@/lib/userdata/store";

const ud: UserData = {
  version: 1,
  artistName: "Kiko",
  importedAt: "2026-09-15",
  format: "distrokid",
  eurRate: 1,
  sourceCurrency: "EUR",
  months: ["2026-06", "2026-07"],
  streamsByMonth: {
    "2026-06": { spotify: 100_000, deezer: 20_000, apple: 10_000 },
    "2026-07": { spotify: 120_000, deezer: 25_000, apple: 12_000 },
  },
  revenueByMonth: { "2026-06": 480, "2026-07": 560 },
  trackStreams: {},
  countryStreams: {},
  totalStreams: 287_000,
  totalRevenueEur: 1_040,
  active: true,
};

describe("calibrationFromUserData", () => {
  it("déduit un taux moyen par stream et un mix réel", () => {
    const c = calibrationFromUserData(ud)!;
    expect(c.averageRate).toBeCloseTo(1_040 / 287_000, 8);
    expect(c.mix.spotify).toBeCloseTo(220_000 / 287_000, 6);
    expect(Object.values(c.mix).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(c.period).toEqual({ from: "2026-06", to: "2026-07" });
  });

  it("répartit le taux moyen par DSP au prorata des coefficients", () => {
    const c = calibrationFromUserData(ud)!;
    expect(c.ratePerStream.deezer!).toBeGreaterThan(c.ratePerStream.spotify!);
    // Le taux pondéré par le mix retombe sur le taux moyen observé.
    const weighted = Object.entries(c.ratePerStream).reduce(
      (s, [dsp, r]) => s + r! * (c.mix[dsp as keyof typeof c.mix] ?? 0),
      0,
    );
    expect(weighted).toBeCloseTo(c.averageRate, 8);
  });

  it("renvoie null sans données actives ou sans streams", () => {
    expect(calibrationFromUserData(null)).toBeNull();
    expect(calibrationFromUserData({ ...ud, active: false })).toBeNull();
    expect(calibrationFromUserData({ ...ud, totalStreams: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2 : Tests écart d'audit**

`src/lib/real/__tests__/audit-gap.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { auditGap, simulatedStatement } from "@/lib/real/audit-gap";

describe("auditGap", () => {
  const estimated = [
    { period: "2026-T2", dsp: "spotify" as const, mid: 10_000 },
    { period: "2026-T2", dsp: "deezer" as const, mid: 3_000 },
  ];

  it("produit un finding attribué au DSP quand l'écart dépasse les deux seuils", () => {
    const f = auditGap("dadju", estimated, [
      { period: "2026-T2", dsp: "spotify", amount: 8_000 },
      { period: "2026-T2", dsp: "deezer", amount: 2_950 },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ artistId: "dadju", expected: 10_000, reported: 8_000, period: "2026-T2" });
    expect(f[0].source).toMatch(/Spotify/);
    expect(f[0].source).not.toMatch(/label|distrib/i);
    expect(f[0].confidence).toBeGreaterThan(0.6);
  });

  it("ignore un écart relatif sous 12 % ou absolu sous 100 €", () => {
    expect(auditGap("x", estimated, [{ period: "2026-T2", dsp: "spotify", amount: 9_000 }])).toHaveLength(0);
    expect(
      auditGap("x", [{ period: "2026-T2", dsp: "spotify", mid: 500 }], [{ period: "2026-T2", dsp: "spotify", amount: 420 }]),
    ).toHaveLength(0);
  });

  it("est déterministe et n'inclut pas les périodes sans relevé", () => {
    const a = auditGap("y", estimated, []);
    expect(a).toHaveLength(0);
  });
});

describe("simulatedStatement", () => {
  it("crée un relevé plausible : un seul DSP sous-payé, les autres proches de l'estimé", () => {
    const est = [
      { period: "2026-T1", dsp: "spotify" as const, mid: 10_000 },
      { period: "2026-T1", dsp: "deezer" as const, mid: 3_000 },
      { period: "2026-T2", dsp: "spotify" as const, mid: 11_000 },
      { period: "2026-T2", dsp: "deezer" as const, mid: 3_200 },
    ];
    const s = simulatedStatement("dadju", est);
    expect(s).toHaveLength(4);
    const gaps = auditGap("dadju", est, s);
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(gaps.every((g) => g.source.includes("Spotify"))).toBe(true);
    expect(JSON.stringify(simulatedStatement("dadju", est))).toBe(JSON.stringify(s));
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/real/__tests__/calibration.test.ts src/lib/real/__tests__/audit-gap.test.ts`
Attendu : FAIL — modules introuvables.

- [ ] **Step 4 : Implémenter `src/lib/real/calibration.ts`**

```ts
/**
 * Calibration par relevé (spec §5.3) : le relevé importé (mode « Mes données »)
 * donne le taux effectif réel et le mix réel de l'artiste. Le relevé DistroKid /
 * TuneCore / Believe ne sépare pas toujours premium/gratuit : on calibre le taux
 * moyen et on le ventile par DSP au prorata des coefficients par défaut.
 */
import type { DSP } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import type { UserData } from "@/lib/userdata/store";
import { DSP_COEF } from "./params";

export type Calibration = {
  averageRate: number;
  ratePerStream: Partial<Record<DSP, number>>;
  mix: Partial<Record<DSP, number>>;
  period: { from: string; to: string };
};

export function calibrationFromUserData(ud: UserData | null): Calibration | null {
  if (!ud || !ud.active || ud.totalStreams <= 0 || ud.months.length === 0) return null;
  const streamsByDsp: Partial<Record<DSP, number>> = {};
  for (const m of Object.values(ud.streamsByMonth)) {
    for (const [dsp, n] of Object.entries(m)) {
      streamsByDsp[dsp as DSP] = (streamsByDsp[dsp as DSP] ?? 0) + (n ?? 0);
    }
  }
  const total = Object.values(streamsByDsp).reduce((s, v) => s + (v ?? 0), 0) || ud.totalStreams;
  const mix: Partial<Record<DSP, number>> = {};
  for (const dsp of DSPS) if (streamsByDsp[dsp]) mix[dsp] = streamsByDsp[dsp]! / total;

  const averageRate = ud.totalRevenueEur / ud.totalStreams;
  // taux(dsp) = k × coef(dsp), avec k tel que Σ mix × taux = averageRate.
  const weightedCoef = DSPS.reduce((s, d) => s + (mix[d] ?? 0) * DSP_COEF[d].mid, 0) || 1;
  const k = averageRate / weightedCoef;
  const ratePerStream: Partial<Record<DSP, number>> = {};
  for (const dsp of DSPS) if (mix[dsp]) ratePerStream[dsp] = k * DSP_COEF[dsp].mid;

  const months = [...ud.months].sort();
  return { averageRate, ratePerStream, mix, period: { from: months[0], to: months[months.length - 1] } };
}
```

- [ ] **Step 5 : Implémenter `src/lib/real/audit-gap.ts`**

```ts
/**
 * Écart estimé / déclaré (spec §5.4). Un finding est TOUJOURS attribué au DSP,
 * jamais au distributeur ni au label (tension Believe §2.6 du brief).
 */
import { rngFor } from "@/lib/demo/seed";
import type { AuditFinding, DSP } from "@/lib/demo/types";
import { AUDIT_GAP_ABS_EUR, AUDIT_GAP_REL } from "./params";

export type EstimatedLine = { period: string; dsp: DSP; mid: number };
export type ReportedLine = { period: string; dsp: DSP; amount: number };

const DSP_LABEL: Record<DSP, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  apple: "Apple Music",
  amazon: "Amazon Music",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Autres DSP",
};

export function auditGap(artistId: string, estimated: EstimatedLine[], reported: ReportedLine[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  let i = 0;
  for (const e of estimated) {
    const r = reported.find((x) => x.period === e.period && x.dsp === e.dsp);
    if (!r) continue;
    const gap = e.mid - r.amount;
    if (gap < AUDIT_GAP_ABS_EUR || gap / Math.max(1, e.mid) < AUDIT_GAP_REL) continue;
    const rel = gap / e.mid;
    out.push({
      id: `${artistId}-gap-${e.dsp}-${e.period}-${i++}`,
      artistId,
      source: `${DSP_LABEL[e.dsp]} — écart estimé / déclaré`,
      period: e.period,
      expected: Math.round(e.mid),
      reported: Math.round(r.amount),
      // Plus l'écart est net, plus on est confiant ; plafonné à 0,92.
      confidence: Math.min(0.92, 0.6 + rel),
      status: out.length === 0 ? "letter-generated" : "open",
    });
  }
  return out.sort((a, b) => b.expected - b.reported - (a.expected - a.reported));
}

/**
 * Relevé simulé pour les artistes dont on n'a pas le vrai relevé (Dadju, Nono) :
 * proche de l'estimé partout, sauf Spotify sur la période la plus récente (−18 %).
 */
export function simulatedStatement(artistId: string, estimated: EstimatedLine[]): ReportedLine[] {
  const rand = rngFor(`${artistId}:statement`);
  const periods = Array.from(new Set(estimated.map((e) => e.period))).sort();
  const last = periods[periods.length - 1];
  return estimated.map((e) => {
    const underpaid = e.dsp === "spotify" && e.period === last;
    const factor = underpaid ? 0.82 : 0.96 + rand() * 0.07;
    return { period: e.period, dsp: e.dsp, amount: Math.round(e.mid * factor) };
  });
}
```

- [ ] **Step 6 : Lancer, vérifier le vert**

Run: `npx vitest run src/lib/real/__tests__/calibration.test.ts src/lib/real/__tests__/audit-gap.test.ts`
Attendu : 7 tests PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/real/calibration.ts src/lib/real/audit-gap.ts src/lib/real/__tests__ && git commit -m "feat(real): calibration par relevé importé et écart d'audit attribué au DSP

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8 : L'adaptateur `real-source` (§4.4)

**Files:**
- Create: `src/lib/real/real-source.ts`, `src/lib/real/index.ts`
- Test: `src/lib/real/__tests__/real-source.test.ts`

Le test utilise un snapshot **fixture** en mémoire pour ne pas dépendre du relevé du jour ; les fonctions prennent donc `snapshots` en paramètre optionnel (défaut : `SNAPSHOTS` du repo).

- [ ] **Step 1 : Tests**

`src/lib/real/__tests__/real-source.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  hasRealData,
  realCountryBreakdown,
  realDailyEstimates,
  realStreamSeries,
  realTopTracks,
  spotifyDailyByTrack,
} from "@/lib/real/real-source";
import type { Snapshot } from "@/lib/real/types";

const TODAY = new Date("2026-09-15T00:00:00Z");

const dadju: Snapshot = {
  date: "2026-09-15",
  spotify: { monthlyListeners: 6_481_936, followers: null, topTracks: [{ name: "Reine", spotifyId: null, playcount: 228_869_436 }] },
  kworb: {
    totalStreams: 4_633_277_280,
    dailyStreams: 1_587_902,
    tracks: [
      { name: "Reine", total: 228_869_436, daily: 82_112 },
      { name: "Meleğim", total: 206_422_360, daily: 55_787 },
      { name: "Vieux titre", total: 1_000_000, daily: null },
    ],
  },
  deezer: { fans: 3_276_021, topTracks: [] },
  youtube: { subscribers: 8_010_000, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_698_165 }] },
  topCities: [
    { city: "Paris", country: "France", listeners: 600_000 },
    { city: "Abidjan", country: "Côte d'Ivoire", listeners: 200_000 },
  ],
};
const dadjuPrev: Snapshot = {
  ...dadju,
  date: "2026-09-14",
  kworb: { ...dadju.kworb!, tracks: [{ name: "Reine", total: 228_787_324, daily: 80_000 }, { name: "Meleğim", total: 206_366_573, daily: 55_000 }] },
  youtube: { subscribers: 8_000_000, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_000_000 }] },
};
const kiko: Snapshot = {
  date: "2026-09-15",
  spotify: {
    monthlyListeners: 24_468,
    followers: null,
    topTracks: [
      { name: "Odjo", spotifyId: null, playcount: 203_809 },
      { name: "Business class", spotifyId: null, playcount: 122_254 },
    ],
  },
  kworb: null,
  deezer: null,
  youtube: null,
  topCities: null,
};
const SNAPS = { dadju: [dadjuPrev, dadju], kiko: [kiko] };

describe("real-source", () => {
  it("hasRealData", () => {
    expect(hasRealData("dadju", SNAPS)).toBe(true);
    expect(hasRealData("inconnu", SNAPS)).toBe(false);
  });

  it("Kworb : le quotidien par titre est mesuré pour les jours couverts, reconstitué avant", () => {
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, SNAPS);
    const reine = byTrack.get("Reine")!;
    expect(reine).toHaveLength(30);
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
    expect(reine[28]).toMatchObject({ date: "2026-09-14", streams: 80_000, provenance: "measured" });
    expect(reine[0].provenance).toBe("reconstructed");
    // Un titre sans débit quotidien est réparti au prorata de son total.
    expect(byTrack.get("Vieux titre")![29].streams).toBeGreaterThan(0);
  });

  it("Spotify du jour = débit Kworb du jour ; YouTube du jour = delta de vues ; les autres DSP sont estimés", () => {
    const s = realStreamSeries("dadju", 2, TODAY, SNAPS);
    const today = s.filter((p) => p.date === "2026-09-15");
    const sp = today.find((p) => p.dsp === "spotify")!;
    expect(sp.streams).toBe(1_587_902);
    expect(sp.provenance).toBe("measured");
    const yt = today.find((p) => p.dsp === "youtube")!;
    expect(yt.streams).toBe(698_165);
    expect(yt.provenance).toBe("measured");
    expect(today.find((p) => p.dsp === "deezer")!.provenance).toBe("estimated");
    expect(today.find((p) => p.dsp === "tiktok")).toBeUndefined();
  });

  it("Kiko (pas de Kworb) : reconstitution à partir des play counts, cohérente avec les auditeurs", () => {
    const s = realStreamSeries("kiko", 30, TODAY, SNAPS);
    const spotify30 = s.filter((p) => p.dsp === "spotify").reduce((a, p) => a + p.streams, 0);
    // ≈ auditeurs mensuels × 2,6 écoutes, à ±40 %.
    expect(spotify30).toBeGreaterThan(24_468 * 2.6 * 0.6);
    expect(spotify30).toBeLessThan(24_468 * 2.6 * 1.4);
    expect(s.every((p) => p.provenance !== "measured" || p.date === "2026-09-15")).toBe(true);
  });

  it("topTracks reflète les débits Kworb", () => {
    const t = realTopTracks("dadju", 7, 2, TODAY, SNAPS);
    expect(t[0].title).toBe("Reine");
    expect(t[0].streams).toBeGreaterThan(t[1].streams);
  });

  it("countryBreakdown vient des villes quand elles existent", () => {
    const c = realCountryBreakdown("dadju", 30, TODAY, SNAPS);
    expect(c[0].iso3).toBe("FRA");
    expect(c.find((x) => x.iso3 === "CIV")).toBeDefined();
  });

  it("dailyEstimates : autant de jours que demandé, brut > 0, provenance du jour = mesuré", () => {
    const e = realDailyEstimates("dadju", 7, TODAY, SNAPS);
    expect(e).toHaveLength(7);
    expect(e[6].grossMaster.mid).toBeGreaterThan(1_000);
    expect(e[6].provenance).toBe("estimated"); // les DSP estimés tirent la provenance vers le bas
    expect(e[6].byDsp.spotify!.provenance).toBe("measured");
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/real/__tests__/real-source.test.ts`
Attendu : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `src/lib/real/real-source.ts`**

```ts
/**
 * Adaptateur snapshots → séries de la forme attendue par src/lib/demo/api.ts
 * (spec §4.4). Toute fonction accepte `snapshots` en paramètre pour les tests.
 */
import { ARTISTS, TRACKS, getArtist } from "@/lib/demo/data";
import { DEMO_TODAY, isoDay, rngFor } from "@/lib/demo/seed";
import type { CountryStreams, DSP, StreamPoint, Track } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import { artistMix, isDeezerPro } from "./dsp-mix";
import { estimateDay } from "./estimator";
import { SPOTIFY_MIN_STREAMS_12M, TIER_FR } from "./params";
import { reconstructTrack, type ReconstructedDay } from "./reconstruct";
import { SNAPSHOTS } from "./snapshots";
import { countriesFromCities, territoryCoefficient, zoneDistribution } from "./territory";
import type { DailyEstimate, Provenance, Snapshot } from "./types";

type Snaps = Record<string, Snapshot[]>;

/** Écoutes par auditeur mensuel — même facteur que les générateurs démo. */
const LISTENS_PER_LISTENER = 2.6;

export function hasRealData(artistId: string, snapshots: Snaps = SNAPSHOTS): boolean {
  return (snapshots[artistId]?.length ?? 0) > 0;
}

export function latestSnapshot(artistId: string, snapshots: Snaps = SNAPSHOTS): Snapshot {
  const s = snapshots[artistId];
  return s[s.length - 1];
}

function dayBefore(today: Date, n: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return isoDay(d);
}

function releaseDateOf(artistId: string, trackName: string): string | undefined {
  return TRACKS.find((t) => t.artistId === artistId && t.title === trackName)?.releaseDate;
}

/**
 * Streams Spotify quotidiens par titre.
 * - Kworb présent : `daily` du jour = mesuré ; les snapshots précédents donnent
 *   les jours précédents (mesurés) ; le reste est reconstitué (§4.3).
 * - Sans Kworb (Kiko) : les titres publics sont reconstitués depuis leurs play
 *   counts (delta J/J-1 mesuré quand deux snapshots existent), et le total est
 *   calé sur auditeurs × 2,6 / 30 par jour.
 */
export function spotifyDailyByTrack(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): Map<string, ReconstructedDay[]> {
  const snaps = snapshots[artistId];
  const last = snaps[snaps.length - 1];
  const out = new Map<string, ReconstructedDay[]>();

  if (last.kworb) {
    const known = last.kworb.tracks.filter((t) => t.daily !== null);
    const knownDaily = known.reduce((s, t) => s + (t.daily ?? 0), 0);
    const unknownTotal = last.kworb.tracks.filter((t) => t.daily === null).reduce((s, t) => s + t.total, 0) || 1;
    const residual = Math.max(0, last.kworb.dailyStreams - knownDaily);
    for (const t of last.kworb.tracks) {
      const dailyNow = t.daily ?? Math.round((residual * t.total) / unknownTotal);
      const measured: Record<string, number> = {};
      for (const s of snaps.slice(0, -1)) {
        const prev = s.kworb?.tracks.find((x) => x.name === t.name);
        if (prev?.daily != null) measured[s.date] = prev.daily;
      }
      out.set(
        t.name,
        reconstructTrack({
          key: `${artistId}:${t.name}`,
          total: t.total,
          dailyNow,
          days,
          today,
          releaseDate: releaseDateOf(artistId, t.name),
          measured,
        }),
      );
    }
    return out;
  }

  // Sans Kworb : play counts publics + catalogue extrapolé.
  const listeners = last.spotify.monthlyListeners ?? getArtist(artistId).monthlyListeners;
  const dailyTarget = (listeners * LISTENS_PER_LISTENER) / 30;
  const tracks = last.spotify.topTracks;
  const totalPlays = tracks.reduce((s, t) => s + t.playcount, 0) || 1;
  // Part des titres publics dans le quotidien : 80 % (le reste = fond de catalogue).
  const publicShare = 0.8;
  for (const t of tracks) {
    const measured: Record<string, number> = {};
    for (let i = 1; i < snaps.length; i++) {
      const a = snaps[i - 1].spotify.topTracks.find((x) => x.name === t.name);
      const b = snaps[i].spotify.topTracks.find((x) => x.name === t.name);
      if (a && b && b.playcount >= a.playcount && snaps[i].date !== last.date) measured[snaps[i].date] = b.playcount - a.playcount;
    }
    const prevSnap = snaps.length > 1 ? snaps[snaps.length - 2].spotify.topTracks.find((x) => x.name === t.name) : null;
    const dailyNow = prevSnap ? Math.max(0, t.playcount - prevSnap.playcount) : Math.round(dailyTarget * publicShare * (t.playcount / totalPlays));
    out.set(
      t.name,
      reconstructTrack({
        key: `${artistId}:${t.name}`,
        total: t.playcount,
        dailyNow,
        days,
        today,
        releaseDate: releaseDateOf(artistId, t.name),
        measured,
      }),
    );
  }
  const rest = Math.round(dailyTarget * (1 - publicShare));
  out.set(
    "__catalogue__",
    reconstructTrack({ key: `${artistId}:catalogue`, total: rest * 400, dailyNow: rest, days, today }),
  );
  return out;
}

function spotifyDaily(artistId: string, days: number, today: Date, snapshots: Snaps): ReconstructedDay[] {
  const byTrack = spotifyDailyByTrack(artistId, days, today, snapshots);
  const acc = new Map<string, { streams: number; provenances: Provenance[] }>();
  for (const series of byTrack.values()) {
    for (const p of series) {
      const cur = acc.get(p.date) ?? { streams: 0, provenances: [] };
      cur.streams += p.streams;
      cur.provenances.push(p.provenance);
      acc.set(p.date, cur);
    }
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      streams: v.streams,
      // Un jour est « mesuré » si la majorité des streams du jour l'est.
      provenance: v.provenances.filter((p) => p === "measured").length * 2 >= v.provenances.length ? "measured" : "reconstructed",
    }));
}

/** Vues YouTube quotidiennes : delta entre snapshots (mesuré), reconstitué avant. */
function youtubeDaily(artistId: string, days: number, today: Date, snapshots: Snaps): { series: ReconstructedDay[]; topicShare: number } | null {
  const snaps = snapshots[artistId];
  const last = snaps[snaps.length - 1];
  if (!last.youtube || last.youtube.videos.length === 0) return null;
  const prev = snaps.length > 1 ? snaps[snaps.length - 2].youtube : null;
  let dailyNow = 0;
  const measured: Record<string, number> = {};
  for (const v of last.youtube.videos) {
    const p = prev?.videos.find((x) => x.videoId === v.videoId);
    if (p && v.views >= p.views) dailyNow += v.views - p.views;
  }
  for (let i = 1; i < snaps.length - 1; i++) {
    const a = snaps[i - 1].youtube?.videos ?? [];
    const b = snaps[i].youtube?.videos ?? [];
    let d = 0;
    for (const v of b) {
      const pv = a.find((x) => x.videoId === v.videoId);
      if (pv && v.views >= pv.views) d += v.views - pv.views;
    }
    if (d > 0) measured[snaps[i].date] = d;
  }
  const totalViews = last.youtube.videos.reduce((s, v) => s + v.views, 0);
  // Sans delta (un seul snapshot) : hypothèse 0,05 % des vues cumulées par jour.
  if (dailyNow === 0) dailyNow = Math.round(totalViews * 0.0005);
  const topicViews = last.youtube.videos.filter((v) => v.channel === "topic").reduce((s, v) => s + v.views, 0);
  return {
    series: reconstructTrack({ key: `${artistId}:youtube`, total: totalViews, dailyNow, days, today, measured }),
    topicShare: totalViews > 0 ? topicViews / totalViews : 0,
  };
}

/** Série par DSP, forme StreamPoint (avec provenance). TikTok exclu (pas un stream rémunéré). */
export function realStreamSeries(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): StreamPoint[] {
  const last = latestSnapshot(artistId, snapshots);
  const spotify = spotifyDaily(artistId, days, today, snapshots);
  const yt = youtubeDaily(artistId, days, today, snapshots);
  const mix = artistMix({
    deezerFans: last.deezer?.fans ?? null,
    spotifyMonthlyListeners: last.spotify.monthlyListeners ?? getArtist(artistId).monthlyListeners,
  });
  const out: StreamPoint[] = [];
  for (let i = 0; i < spotify.length; i++) {
    const sp = spotify[i];
    out.push({ date: sp.date, dsp: "spotify", streams: sp.streams, provenance: sp.provenance });
    for (const dsp of DSPS) {
      if (dsp === "spotify" || dsp === "tiktok") continue;
      if (dsp === "youtube" && yt) {
        const y = yt.series[i];
        out.push({ date: y.date, dsp, streams: y.streams, provenance: y.provenance });
        continue;
      }
      const est = Math.round((sp.streams * mix[dsp]) / mix.spotify);
      if (est > 0) out.push({ date: sp.date, dsp, streams: est, provenance: "estimated" });
    }
  }
  return out;
}

export function realTopTracks(
  artistId: string,
  days: number,
  limit: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): Array<Track & { streams: number }> {
  const byTrack = spotifyDailyByTrack(artistId, days, today, snapshots);
  const rows: Array<Track & { streams: number }> = [];
  for (const [name, series] of byTrack) {
    if (name === "__catalogue__") continue;
    const known = TRACKS.find((t) => t.artistId === artistId && t.title === name);
    rows.push({
      id: known?.id ?? `${artistId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      artistId,
      projectId: known?.projectId ?? "",
      title: name,
      isrc: known?.isrc ?? "—",
      releaseDate: known?.releaseDate ?? "",
      durationSec: known?.durationSec ?? 0,
      weight: 0,
      streams: series.reduce((s, p) => s + p.streams, 0),
    });
  }
  const total = rows.reduce((s, r) => s + r.streams, 0) || 1;
  for (const r of rows) r.weight = r.streams / total;
  return rows.sort((a, b) => b.streams - a.streams).slice(0, limit);
}

export function realCountryBreakdown(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): CountryStreams[] | null {
  const last = latestSnapshot(artistId, snapshots);
  if (!last.topCities || last.topCities.length === 0) return null;
  const total = realStreamSeries(artistId, days, today, snapshots).reduce((s, p) => s + p.streams, 0);
  return countriesFromCities(last.topCities, total);
}

export function realMonthlyListeners(artistId: string, snapshots: Snaps = SNAPSHOTS): number | null {
  return latestSnapshot(artistId, snapshots).spotify.monthlyListeners;
}

/** Part des streams rémunérables : titres sous le seuil Spotify 12 mois exclus. */
function payableShare(artistId: string, today: Date, snapshots: Snaps): number {
  const byTrack = spotifyDailyByTrack(artistId, 365, today, snapshots);
  let total = 0;
  let payable = 0;
  for (const [name, series] of byTrack) {
    const sum = series.reduce((s, p) => s + p.streams, 0);
    total += sum;
    if (name === "__catalogue__" || sum >= SPOTIFY_MIN_STREAMS_12M) payable += sum;
  }
  return total > 0 ? payable / total : 1;
}

export function realDailyEstimates(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
  rateOverrides?: Partial<Record<DSP, number>>,
): DailyEstimate[] {
  const artist = ARTISTS.find((a) => a.id === artistId) ?? getArtist(artistId);
  const last = latestSnapshot(artistId, snapshots);
  const series = realStreamSeries(artistId, days, today, snapshots);
  const yt = youtubeDaily(artistId, days, today, snapshots);
  const territoryCoef = territoryCoefficient(zoneDistribution(last.topCities, artist.country));
  const listeners = last.spotify.monthlyListeners ?? artist.monthlyListeners;
  const monthly = series.filter((p) => p.dsp === "spotify").slice(-30).reduce((s, p) => s + p.streams, 0);
  const deezerPro = isDeezerPro({ monthlyStreams: monthly, monthlyListeners: listeners });
  const payable = payableShare(artistId, today, snapshots);

  const byDate = new Map<string, DailyEstimate>();
  const dates = Array.from(new Set(series.map((p) => p.date))).sort();
  for (const date of dates) {
    const byDsp: Parameters<typeof estimateDay>[0]["byDsp"] = {};
    for (const p of series) {
      if (p.date !== date) continue;
      byDsp[p.dsp] = {
        streams: p.streams,
        provenance: p.provenance ?? "estimated",
        youtubeTopicShare: p.dsp === "youtube" ? (yt?.topicShare ?? 0) : undefined,
      };
    }
    byDate.set(date, estimateDay({ date, byDsp, territoryCoef, tier: TIER_FR, deezerPro, payableShare: payable, rateOverrides }));
  }
  return dates.map((d) => byDate.get(d)!);
}

/** Provenance dominante par DSP sur la fenêtre (pour la légende de l'UI). */
export function realProvenanceByDsp(artistId: string, days: number, today: Date = DEMO_TODAY, snapshots: Snaps = SNAPSHOTS): Partial<Record<DSP, Provenance>> {
  const out: Partial<Record<DSP, Provenance>> = {};
  for (const p of realStreamSeries(artistId, days, today, snapshots)) {
    const cur = out[p.dsp];
    const prov = p.provenance ?? "estimated";
    if (!cur || (cur === "measured" && prov !== "measured")) out[p.dsp] = cur === "measured" && prov === "reconstructed" ? "reconstructed" : (cur ?? prov);
  }
  return out;
}

/** Pour les tests de déterminisme : une clé stable du relevé. */
export function snapshotKey(artistId: string, snapshots: Snaps = SNAPSHOTS): string {
  return `${artistId}:${latestSnapshot(artistId, snapshots).date}:${rngFor(artistId)()}`;
}
```

Note : `realProvenanceByDsp` doit renvoyer, pour chaque DSP, la provenance la plus **faible** rencontrée (mesuré < reconstitué < estimé). Si l'expression ci-dessus paraît tordue, la remplacer par `out[p.dsp] = weakest([cur ?? "measured", prov])` en important `weakest` depuis `./estimator` — c'est l'intention.

- [ ] **Step 4 : Point d'entrée `src/lib/real/index.ts`**

```ts
export { hasRealData, latestSnapshot, realCountryBreakdown, realDailyEstimates, realMonthlyListeners, realProvenanceByDsp, realStreamSeries, realTopTracks } from "./real-source";
export { summarize, weakest } from "./estimator";
export { calibrationFromUserData, type Calibration } from "./calibration";
export { auditGap, simulatedStatement } from "./audit-gap";
export type { Confidence, DailyEstimate, EstimatePeriod, EstimateSummary, Provenance, Range, Snapshot } from "./types";
```

- [ ] **Step 5 : Lancer, itérer jusqu'au vert**

Run: `npx vitest run src/lib/real/__tests__/real-source.test.ts`
Attendu : 7 tests PASS. Points d'attention si ça casse :
- « Kiko … cohérente avec les auditeurs » : la somme sur 30 j dépend de `publicShare` et du plafond `total × 0,95` de la reconstruction (les play counts de Kiko sont petits : `Odjo` 203 k pour ~2 000/j × 30 j = 60 k, ça passe) ;
- YouTube du jour = 439 698 165 − 439 000 000 = 698 165.

- [ ] **Step 6 : Déterminisme global**

Ajouter dans `src/lib/demo/__tests__/determinism.test.ts`, après le `describe("déterminisme des générateurs")` :

```ts
import { realDailyEstimates, realStreamSeries } from "@/lib/real";

describe("déterminisme de la couche réelle", () => {
  it.each(ARTIST_IDS)("realStreamSeries(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(realStreamSeries(id, 90))).toBe(JSON.stringify(realStreamSeries(id, 90)));
  });
  it.each(ARTIST_IDS)("realDailyEstimates(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(realDailyEstimates(id, 30))).toBe(JSON.stringify(realDailyEstimates(id, 30)));
  });
});
```

(Déplacer l'`import` en tête de fichier avec les autres.)

Run: `npm test`
Attendu : tout vert, y compris avec les vrais snapshots du repo.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/real src/lib/demo/__tests__/determinism.test.ts && git commit -m "feat(real): adaptateur snapshots → séries (Spotify mesuré/reconstitué, YouTube mesuré, DSP estimés, villes → pays)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9 : Brancher la façade `api.ts`

**Files:**
- Modify: `src/lib/demo/generators.ts:110-118` (`revenueSeries`), `src/lib/demo/api.ts`
- Test: `src/lib/demo/__tests__/api-real.test.ts`

- [ ] **Step 1 : Test d'intégration de la façade**

`src/lib/demo/__tests__/api-real.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  ARTISTS,
  auditFindings,
  countryBreakdown,
  dailyEstimates,
  estimateSummary,
  provenanceByDsp,
  revenueSeries,
  streamSeries,
  sumStreams,
  topTracks,
} from "@/lib/demo/api";
import { latestSnapshot } from "@/lib/real";

describe("api.ts sur les artistes réels", () => {
  it.each(ARTISTS.map((a) => a.id))("%s : streams du jour Spotify = débit du snapshot (si Kworb)", (id) => {
    const snap = latestSnapshot(id);
    if (!snap.kworb) return;
    const today = streamSeries(id, 1).find((p) => p.dsp === "spotify")!;
    expect(today.streams).toBe(snap.kworb.dailyStreams);
    expect(today.provenance).toBe("measured");
  });

  it("dadju : le streaming des revenus mensuels vient de l'estimateur", () => {
    const rev = revenueSeries("dadju", 24).filter((p) => p.source === "streaming");
    const est = dailyEstimates("dadju", 365);
    const lastMonth = rev[rev.length - 1];
    const fromEstimator = est.filter((d) => d.date.startsWith(lastMonth.month)).reduce((s, d) => s + d.grossMaster.mid, 0);
    expect(lastMonth.amount).toBe(Math.round(fromEstimator));
  });

  it("estimateSummary : jour ≤ semaine ≤ mois ≤ année, en fourchette", () => {
    const d = estimateSummary("dadju", "day");
    const w = estimateSummary("dadju", "week");
    const m = estimateSummary("dadju", "month");
    const y = estimateSummary("dadju", "year");
    expect(d.grossMaster.mid).toBeLessThan(w.grossMaster.mid);
    expect(w.grossMaster.mid).toBeLessThan(m.grossMaster.mid);
    expect(m.grossMaster.mid).toBeLessThan(y.grossMaster.mid);
    expect(d.grossMaster.low).toBeLessThan(d.grossMaster.high);
    expect(d.artistShare.mid).toBeLessThan(d.grossMaster.mid);
  });

  it("auditFindings des artistes réels sont attribués à un DSP", () => {
    const f = auditFindings("dadju");
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.source.includes("Spotify"))).toBe(true);
  });

  it("topTracks de Dadju commence par un titre relevé", () => {
    const t = topTracks("dadju", 30, 3);
    const names = latestSnapshot("dadju").kworb!.tracks.map((x) => x.name);
    expect(names).toContain(t[0].title);
  });

  it("countryBreakdown et provenanceByDsp répondent", () => {
    expect(countryBreakdown("dadju", 30).length).toBeGreaterThan(0);
    expect(provenanceByDsp("dadju", 30).spotify).toBeDefined();
    expect(sumStreams("kiko", 30)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/demo/__tests__/api-real.test.ts`
Attendu : FAIL — `dailyEstimates` n'est pas exporté.

- [ ] **Step 3 : Override du streaming dans `generators.ts`**

Remplacer la signature et le calcul du streaming dans `revenueSeries` :

```ts
/** Revenus mensuels par source sur `months` mois (défaut 24).
 *  `streamingOverride` (mois → € brut master) remplace le calcul synthétique — artistes réels. */
export function revenueSeries(
  artistId: string,
  months = 24,
  streamingOverride?: Map<string, number>,
): RevenuePoint[] {
```

et, dans la boucle, remplacer :

```ts
    const streaming = monthlyStreams * STREAM_RATE * (0.92 + rand() * 0.16);
```

par :

```ts
    const synthetic = monthlyStreams * STREAM_RATE * (0.92 + rand() * 0.16);
    const streaming = streamingOverride?.get(month) ?? synthetic;
```

(le `rand()` est consommé dans les deux cas : le reste de la série garde son bruit.)

- [ ] **Step 4 : Routage dans `api.ts`**

En tête de `src/lib/demo/api.ts`, ajouter les imports :

```ts
import {
  auditGap,
  calibrationFromUserData,
  hasRealData,
  realCountryBreakdown,
  realDailyEstimates,
  realProvenanceByDsp,
  realStreamSeries,
  realTopTracks,
  simulatedStatement,
  summarize,
  type DailyEstimate,
  type EstimatePeriod,
  type EstimateSummary,
  type Provenance,
} from "@/lib/real";
import { getUserData } from "@/lib/userdata/store";
import type { DSP } from "./types";
```

Remplacer `streamSeries` :

```ts
export function streamSeries(artistId: string, days = 365): StreamPoint[] {
  if (isUserArtist(artistId)) return userStreamSeries(days, DEMO_TODAY);
  if (hasRealData(artistId)) return realStreamSeries(artistId, days);
  return genStreamSeries(artistId, days);
}
```

`dailyTotals` : la branche démo agrège déjà `genStreamSeries` ; la remplacer pour qu'elle agrège `streamSeries(artistId, days)` (et donc le réel) :

```ts
export function dailyTotals(artistId: string, days = 365) {
  const byDay = new Map<string, number>();
  for (const p of streamSeries(artistId, days)) {
    byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.streams);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }));
}
```

Remplacer `revenueSeries` :

```ts
export function revenueSeries(artistId: string, months = 24): RevenuePoint[] {
  if (isUserArtist(artistId)) return userRevenueSeries(months, DEMO_TODAY);
  if (hasRealData(artistId)) {
    const byMonth = new Map<string, number>();
    for (const d of dailyEstimates(artistId, 365 * 2)) {
      const m = d.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + d.grossMaster.mid);
    }
    for (const [m, v] of byMonth) byMonth.set(m, Math.round(v));
    return genRevenueSeries(artistId, months, byMonth);
  }
  return genRevenueSeries(artistId, months);
}
```

Remplacer `countryBreakdown` :

```ts
export function countryBreakdown(artistId: string, days = 30): CountryStreams[] {
  if (isUserArtist(artistId)) return userCountryBreakdown();
  if (hasRealData(artistId)) {
    const real = realCountryBreakdown(artistId, days);
    if (real) return real;
  }
  return genCountryBreakdown(artistId, days);
}
```

Remplacer `auditFindings` :

```ts
export function auditFindings(artistId: string): AuditFinding[] {
  if (isUserArtist(artistId)) return [];
  const rights = genAuditFindings(artistId).filter((f) => !f.id.endsWith("-af-label"));
  if (!hasRealData(artistId)) return genAuditFindings(artistId);
  // Artistes réels : écart estimé / déclaré par trimestre et par DSP (§5.4).
  const est = dailyEstimates(artistId, 365);
  const lines = new Map<string, { period: string; dsp: DSP; mid: number }>();
  for (const d of est) {
    const q = `${d.date.slice(0, 4)}-T${Math.floor((Number(d.date.slice(5, 7)) - 1) / 3) + 1}`;
    for (const [dsp, v] of Object.entries(d.byDsp)) {
      const key = `${q}:${dsp}`;
      const cur = lines.get(key) ?? { period: q, dsp: dsp as DSP, mid: 0 };
      cur.mid += v.gross.mid;
      lines.set(key, cur);
    }
  }
  // On ne juge que les trimestres clos.
  const currentQ = `${DEMO_TODAY.toISOString().slice(0, 4)}-T${Math.floor(DEMO_TODAY.getUTCMonth() / 3) + 1}`;
  const closed = Array.from(lines.values()).filter((l) => l.period !== currentQ);
  return [...auditGap(artistId, closed, simulatedStatement(artistId, closed)), ...rights];
}
```

Remplacer la branche démo de `topTracks` (après le bloc `isUserArtist`) :

```ts
  if (hasRealData(artistId)) return realTopTracks(artistId, days, limit);
  const total = sumStreams(artistId, days);
```

Ajouter à la fin de la section « Agrégats streams » :

```ts
/* ─────────────── Estimation « stream rémunérateur » (artistes réels) ─────────────── */

function activeCalibration(artistId: string) {
  // La calibration vient du relevé importé ; en démo elle ne s'applique qu'au profil utilisateur
  // ou à Kiko si Gaël importe son vrai relevé (spec §5.3).
  const c = calibrationFromUserData(getUserData());
  return c && (isUserArtist(artistId) || artistId === "kiko") ? c : null;
}

export function dailyEstimates(artistId: string, days = 365): DailyEstimate[] {
  if (!hasRealData(artistId)) return [];
  const cal = activeCalibration(artistId);
  return realDailyEstimates(artistId, days, DEMO_TODAY, undefined, cal?.ratePerStream);
}

export function estimateSummary(artistId: string, period: EstimatePeriod): EstimateSummary {
  const a = getArtist(artistId);
  return summarize(dailyEstimates(artistId, 365), period, {
    calibrated: activeCalibration(artistId) !== null,
    dealType: a.dealType,
  });
}

/** Résumé agrégé roster (vue label). */
export function rosterEstimateSummary(period: EstimatePeriod): EstimateSummary {
  const parts = ARTISTS.filter((a) => hasRealData(a.id)).map((a) => estimateSummary(a.id, period));
  const add = (k: "grossMaster" | "artistShare" | "publishing") =>
    parts.reduce((acc, p) => ({ low: acc.low + p[k].low, mid: acc.mid + p[k].mid, high: acc.high + p[k].high }), { low: 0, mid: 0, high: 0 });
  const first = parts[0];
  return {
    period,
    from: first?.from ?? "",
    to: first?.to ?? "",
    streams: parts.reduce((s, p) => s + p.streams, 0),
    payableStreams: parts.reduce((s, p) => s + p.payableStreams, 0),
    grossMaster: add("grossMaster"),
    artistShare: add("artistShare"),
    publishing: add("publishing"),
    confidence: parts.some((p) => p.confidence === "indicative") ? "indicative" : parts.every((p) => p.confidence === "high") ? "high" : "medium",
    provenance: parts.some((p) => p.provenance === "estimated") ? "estimated" : parts.some((p) => p.provenance === "reconstructed") ? "reconstructed" : "measured",
    calibrated: parts.every((p) => p.calibrated),
  };
}

export function provenanceByDsp(artistId: string, days = 30): Partial<Record<DSP, Provenance>> {
  if (!hasRealData(artistId)) return {};
  return realProvenanceByDsp(artistId, days);
}

export function hasReal(artistId: string): boolean {
  return hasRealData(artistId);
}
```

- [ ] **Step 5 : Tests, types, lint**

Run: `npx vitest run src/lib/demo/__tests__/api-real.test.ts && npm test && npx tsc --noEmit && npm run lint`
Attendu : tout vert. Si `pnl.test.ts` ou `valuation.test.ts` casse sur des ordres de grandeur (les revenus de Dadju sont 100× ceux de l'ancien roster), lire l'assertion : si elle teste une propriété (signe, tri, somme), l'ajuster aux nouvelles valeurs ; si elle teste une constante magique, la remplacer par la propriété.

- [ ] **Step 6 : Vérification visuelle en dev**

Run: `npm run dev` puis `/pulse` (Dadju) : « Streams aujourd'hui » doit afficher ≈ 2,9 M (Spotify 1,59 M + DSP estimés + YouTube) et le chart 90 j une courbe plausible ; `/streams` : la répartition DSP ; `/audience` : la carte avec les pays des villes ; `/audit` : un finding « Spotify — écart estimé / déclaré ».

- [ ] **Step 7 : Commit**

```bash
git add src/lib/demo && git commit -m "feat(api): façade branchée sur la couche réelle — streams, revenus estimés, pays, audit, résumés d'estimation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10 : Badge de provenance et KpiCard

**Files:**
- Create: `src/components/ui/provenance-badge.tsx`
- Modify: `src/components/dashboard/kpi.tsx:84-140`, `src/messages/fr/common.json`, `src/messages/en/common.json`

- [ ] **Step 1 : Clés i18n**

Dans `src/messages/fr/common.json`, ajouter au niveau racine :

```json
  "provenance": {
    "measured": "Mesuré",
    "reconstructed": "Reconstitué",
    "estimated": "Estimé",
    "simulated": "Simulé",
    "tip": {
      "measured": "Relevé sur les compteurs publics (Spotify, Kworb, YouTube) ou sur un relevé importé.",
      "reconstructed": "Historique reconstitué à partir du total cumulé et du débit quotidien réel — la courbe est plausible, pas relevée jour par jour.",
      "estimated": "Extrapolé depuis Spotify avec le mix DSP de l'artiste — aucune plateforme ne publie ces chiffres.",
      "simulated": "Donnée de démonstration, inventée pour être cohérente avec le réel."
    },
    "confidence": {
      "high": "Confiance élevée",
      "medium": "Confiance moyenne",
      "indicative": "Indicatif"
    }
  }
```

Même bloc dans `src/messages/en/common.json` :

```json
  "provenance": {
    "measured": "Measured",
    "reconstructed": "Reconstructed",
    "estimated": "Estimated",
    "simulated": "Simulated",
    "tip": {
      "measured": "Read from public counters (Spotify, Kworb, YouTube) or from an imported statement.",
      "reconstructed": "History rebuilt from the cumulative total and today's real daily rate — plausible, not read day by day.",
      "estimated": "Extrapolated from Spotify with the artist's DSP mix — no platform publishes these figures.",
      "simulated": "Demo data, invented to stay consistent with the real numbers."
    },
    "confidence": {
      "high": "High confidence",
      "medium": "Medium confidence",
      "indicative": "Indicative"
    }
  }
```

- [ ] **Step 2 : Le badge**

`src/components/ui/provenance-badge.tsx` (dans `ui/`, donc hors règle anti-hardcode — mais on passe quand même par next-intl) :

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { Provenance } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const TONE: Record<Provenance, string> = {
  measured: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  reconstructed: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  estimated: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  simulated: "border-muted-foreground/30 text-muted-foreground",
};

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  const t = useTranslations("common.provenance");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border bg-card px-1.5 text-[10px] font-medium uppercase tracking-wide",
            TONE[provenance],
            className,
          )}
        >
          {t(provenance)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{t(`tip.${provenance}`)}</TooltipContent>
    </Tooltip>
  );
}
```

Vérifier que `TooltipProvider` enveloppe déjà l'app (`grep -rn TooltipProvider src/components/providers.tsx`). Sinon l'ajouter dans `Providers`.

- [ ] **Step 3 : Prop `provenance` sur KpiCard**

Dans `src/components/dashboard/kpi.tsx`, ajouter à `KpiCardProps` : `provenance?: Provenance;` (import `type { Provenance } from "@/lib/demo/types"` et `ProvenanceBadge`). Dans la fonction, destructurer `provenance`, et remplacer la ligne du label :

```tsx
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {label}
          {provenance && <ProvenanceBadge provenance={provenance} />}
        </span>
```

- [ ] **Step 4 : Tests et lint**

Run: `npm test && npm run lint`
Attendu : parité fr/en OK, lint OK.

- [ ] **Step 5 : Commit**

```bash
git add src/components/ui/provenance-badge.tsx src/components/dashboard/kpi.tsx src/messages && git commit -m "feat(ui): badge de provenance (mesuré / reconstitué / estimé / simulé) sur les KPI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11 : L'estimation dans l'UI — Pulse, Revenus, Streams

**Files:**
- Create: `src/components/modules/pilotage/estimate-board.tsx`
- Modify: `src/app/(dashboard)/pulse/page.tsx`, `src/app/(dashboard)/revenue/page.tsx`, `src/app/(dashboard)/streams/page.tsx`, `src/messages/{fr,en}/{pulse,revenue,streams}.json`

- [ ] **Step 1 : Clés i18n**

`src/messages/fr/pulse.json`, dans `"kpis"` :

```json
    "earnedYesterday": "Gains estimés hier",
    "earnedWeek": "Gains estimés · 7 jours",
    "rangeHint": "{low} – {high}",
    "grossHint": "brut master, avant partage"
```

et un nouveau bloc racine :

```json
  "estimate": {
    "title": "Ce que ça rapporte — estimation en continu",
    "subtitle": "Streams rémunérateurs × taux France (SNEP 2025), corrigés par plateforme, territoire et modèle Deezer artist-centric. Un relevé importé recalibre tout.",
    "titleLabel": "Ce que le roster rapporte — estimation en continu"
  }
```

`src/messages/en/pulse.json` :

```json
    "earnedYesterday": "Estimated earnings yesterday",
    "earnedWeek": "Estimated earnings · 7 days",
    "rangeHint": "{low} – {high}",
    "grossHint": "gross master, before split"
```

```json
  "estimate": {
    "title": "What it earns — live estimate",
    "subtitle": "Payable streams × French rate (SNEP 2025), adjusted per platform, territory and Deezer's artist-centric model. An imported statement recalibrates everything.",
    "titleLabel": "What the roster earns — live estimate"
  }
```

`src/messages/fr/revenue.json`, bloc racine :

```json
  "estimate": {
    "title": "Estimation live",
    "subtitle": "Ce que génèrent les streams, jour par jour — brut master, part artiste, droits d'auteur.",
    "period": { "day": "Hier", "week": "7 jours", "month": "30 jours", "year": "12 mois" },
    "gross": "Brut master",
    "artist": "Part artiste",
    "publishing": "Droits d'auteur (édition)",
    "streams": "{streams} streams · {payable} rémunérateurs",
    "range": "{low} – {high}",
    "calibrated": "Calibré par relevé",
    "notCalibrated": "Taux par défaut — importez un relevé pour calibrer",
    "byDsp": "Par plateforme (30 jours)",
    "dspRate": "{rate} €/stream"
  }
```

`src/messages/en/revenue.json` :

```json
  "estimate": {
    "title": "Live estimate",
    "subtitle": "What streams generate, day by day — gross master, artist share, songwriter royalties.",
    "period": { "day": "Yesterday", "week": "7 days", "month": "30 days", "year": "12 months" },
    "gross": "Gross master",
    "artist": "Artist share",
    "publishing": "Songwriter royalties (publishing)",
    "streams": "{streams} streams · {payable} payable",
    "range": "{low} – {high}",
    "calibrated": "Calibrated from statement",
    "notCalibrated": "Default rates — import a statement to calibrate",
    "byDsp": "By platform (30 days)",
    "dspRate": "{rate} €/stream"
  }
```

`src/messages/fr/streams.json` et `en/streams.json`, bloc racine :

```json
  "provenanceLegend": "Provenance par plateforme"
```
```json
  "provenanceLegend": "Provenance by platform"
```

- [ ] **Step 2 : Le composant `EstimateBoard`**

`src/components/modules/pilotage/estimate-board.tsx` :

```tsx
"use client";

/**
 * Tuiles jour / semaine / mois / année de l'estimateur « stream rémunérateur »,
 * chacune en fourchette avec sa confiance et sa provenance.
 */
import { useLocale, useTranslations } from "next-intl";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { EstimatePeriod, EstimateSummary } from "@/lib/real";
import { fmtCompact, fmtEur, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS: EstimatePeriod[] = ["day", "week", "month", "year"];

export function EstimateBoard({
  summaries,
  line = "grossMaster",
  className,
}: {
  summaries: Record<EstimatePeriod, EstimateSummary>;
  /** Quelle cascade afficher en gros : brut master (label) ou part artiste (artiste). */
  line?: "grossMaster" | "artistShare";
  className?: string;
}) {
  const t = useTranslations("revenue.estimate");
  const tc = useTranslations("common.provenance");
  const locale = useLocale();

  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {summaries.month.calibrated ? t("calibrated") : t("notCalibrated")}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PERIODS.map((p) => {
          const s = summaries[p];
          const r = s[line];
          return (
            <div key={p} className="rounded-lg border bg-surface-2/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t(`period.${p}`)}</span>
                <ProvenanceBadge provenance={s.provenance} />
              </div>
              <p className="num mt-1 text-2xl font-semibold tracking-tight">{fmtEur(locale, r.mid)}</p>
              <p className="num text-xs text-muted-foreground">
                {t("range", { low: fmtEur(locale, r.low), high: fmtEur(locale, r.high) })}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("streams", {
                  streams: fmtCompact(locale, s.streams),
                  payable: fmtCompact(locale, s.payableStreams),
                })}
              </p>
              <p className="text-[11px] text-muted-foreground">{tc(`confidence.${s.confidence}`)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t pt-2 text-[11px]">
                <dt className="text-muted-foreground">{t("gross")}</dt>
                <dd className="num text-right">{fmtInt(locale, Math.round(s.grossMaster.mid))} €</dd>
                <dt className="text-muted-foreground">{t("artist")}</dt>
                <dd className="num text-right">{fmtInt(locale, Math.round(s.artistShare.mid))} €</dd>
                <dt className="text-muted-foreground">{t("publishing")}</dt>
                <dd className="num text-right">{fmtInt(locale, Math.round(s.publishing.mid))} €</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3 : Pulse — KPI gains estimés + board**

Dans `src/app/(dashboard)/pulse/page.tsx` :

Imports à ajouter :

```tsx
import { EstimateBoard } from "@/components/modules/pilotage/estimate-board";
import { estimateSummary, hasReal, provenanceByDsp, rosterEstimateSummary } from "@/lib/demo/api";
import { fmtEur } from "@/lib/format";
```

Dans `artistView` (le `useMemo`), après `const series90 = …` :

```tsx
    const real = hasReal(artistId);
    const est = real
      ? {
          day: estimateSummary(artistId, "day"),
          week: estimateSummary(artistId, "week"),
          month: estimateSummary(artistId, "month"),
          year: estimateSummary(artistId, "year"),
        }
      : null;
    const streamsProvenance = provenanceByDsp(artistId, 1).spotify;
```

et les ajouter au `return` : `est, streamsProvenance`.

Dans le rendu artiste, sur le KPI héro `pulse-hero`, ajouter `provenance={artistView.streamsProvenance}`. Remplacer le KPI `pulse-rev` (revenus du mois) par, **quand `artistView.est` existe**, deux KPI :

```tsx
            {artistView.est ? (
              <>
                <KpiStaggerItem>
                  <KpiCard
                    id="pulse-earned-day"
                    className="h-full"
                    label={t("kpis.earnedYesterday")}
                    value={Math.round(artistView.est.day[persona === "artist" ? "artistShare" : "grossMaster"].mid)}
                    format="eur"
                    deltaLabel={t("kpis.rangeHint", {
                      low: fmtEur(locale, artistView.est.day[persona === "artist" ? "artistShare" : "grossMaster"].low),
                      high: fmtEur(locale, artistView.est.day[persona === "artist" ? "artistShare" : "grossMaster"].high),
                    })}
                    provenance={artistView.est.day.provenance}
                  />
                </KpiStaggerItem>
                <KpiStaggerItem>
                  <KpiCard
                    id="pulse-earned-week"
                    className="h-full"
                    label={t("kpis.earnedWeek")}
                    value={Math.round(artistView.est.week[persona === "artist" ? "artistShare" : "grossMaster"].mid)}
                    format="eur"
                    deltaLabel={t("kpis.grossHint")}
                    provenance={artistView.est.week.provenance}
                  />
                </KpiStaggerItem>
              </>
            ) : (
              <KpiStaggerItem>
                <KpiCard … (le KPI pulse-rev existant, inchangé) … />
              </KpiStaggerItem>
            )}
```

(la grille passe de `xl:grid-cols-6` à `xl:grid-cols-7` quand `est` existe : `className={cn("grid gap-4 sm:grid-cols-2", artistView.est ? "xl:grid-cols-7" : "xl:grid-cols-6")}` — importer `cn`.)

Après la section « Grand chart 90 j », ajouter :

```tsx
          {artistView.est && (
            <EstimateBoard
              summaries={artistView.est}
              line={persona === "artist" ? "artistShare" : "grossMaster"}
            />
          )}
```

Dans `labelView`, ajouter `const est = { day: rosterEstimateSummary("day"), week: rosterEstimateSummary("week"), month: rosterEstimateSummary("month"), year: rosterEstimateSummary("year") };` au `return`, et après le bloc « Chart agrégé + top movers » :

```tsx
          <EstimateBoard summaries={labelView.est} line="grossMaster" />
```

- [ ] **Step 4 : Revenus — section estimation**

Dans `src/app/(dashboard)/revenue/page.tsx`, importer `EstimateBoard`, `estimateSummary`, `hasReal`, `dailyEstimates`, `ProvenanceBadge`. Dans le corps, calculer :

```tsx
  const est = useMemo(() => {
    if (!hasReal(artistId)) return null;
    return {
      day: estimateSummary(artistId, "day"),
      week: estimateSummary(artistId, "week"),
      month: estimateSummary(artistId, "month"),
      year: estimateSummary(artistId, "year"),
    };
  }, [artistId]);

  const byDsp = useMemo(() => {
    if (!hasReal(artistId)) return [];
    const acc = new Map<string, { streams: number; gross: number; provenance: Provenance }>();
    for (const d of dailyEstimates(artistId, 30)) {
      for (const [dsp, v] of Object.entries(d.byDsp)) {
        const cur = acc.get(dsp) ?? { streams: 0, gross: 0, provenance: v.provenance };
        cur.streams += v.streams;
        cur.gross += v.gross.mid;
        acc.set(dsp, cur);
      }
    }
    return Array.from(acc.entries())
      .map(([dsp, v]) => ({ dsp, ...v, rate: v.streams > 0 ? v.gross / v.streams : 0 }))
      .sort((a, b) => b.gross - a.gross);
  }, [artistId]);
```

(`artistId` est celui de `useRole()` — en vue roster agrégée, garder la page telle quelle : la section ne s'affiche que si `est` existe.) Insérer juste sous le `PageHeader` :

```tsx
      {est && (
        <div className="mb-4 space-y-4">
          <EstimateBoard summaries={est} line={persona === "artist" ? "artistShare" : "grossMaster"} />
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium">{t("estimate.byDsp")}</h2>
            <table className="w-full text-sm">
              <tbody>
                {byDsp.map((row) => (
                  <tr key={row.dsp} className="border-t">
                    <td className="py-2 capitalize">{row.dsp}</td>
                    <td className="py-2"><ProvenanceBadge provenance={row.provenance} /></td>
                    <td className="num py-2 text-right">{fmtCompact(locale, row.streams)}</td>
                    <td className="num py-2 text-right text-muted-foreground">
                      {t("estimate.dspRate", { rate: row.rate.toFixed(4) })}
                    </td>
                    <td className="num py-2 text-right font-medium">{fmtEur(locale, row.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
```

(importer `fmtCompact` et `type { Provenance }`.)

- [ ] **Step 5 : Streams — légende de provenance**

Dans `src/app/(dashboard)/streams/page.tsx`, importer `provenanceByDsp` et `ProvenanceBadge`, calculer `const prov = useMemo(() => provenanceByDsp(artistId, 30), [artistId]);` et, sous le composant `DspBreakdown`, ajouter :

```tsx
        {Object.keys(prov).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t("provenanceLegend")}</span>
            {Object.entries(prov).map(([dsp, p]) => (
              <span key={dsp} className="inline-flex items-center gap-1">
                <span className="capitalize">{dsp}</span>
                <ProvenanceBadge provenance={p!} />
              </span>
            ))}
          </div>
        )}
```

- [ ] **Step 6 : Tests, lint, types**

Run: `npm test && npm run lint && npx tsc --noEmit`
Attendu : tout vert (parité fr/en comprise).

- [ ] **Step 7 : Vérifier dans le navigateur, 3 thèmes**

Run: `npm run dev` puis `/pulse` en vue artiste (Dadju) : deux KPI « Gains estimés » avec fourchette, badge « mesuré » sur le héro, board 4 tuiles ; vue label : board agrégé. `/revenue` Dadju : board + tableau par plateforme avec badges. `/streams` : légende. Basculer les 3 thèmes (menu topbar) : les couleurs des badges restent lisibles.

- [ ] **Step 8 : Commit**

```bash
git add src/app src/components src/messages && git commit -m "feat(ui): estimation live — KPI gains estimés sur Pulse, board jour/semaine/mois/année, tableau par plateforme, légende de provenance

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12 : Canal Universal — `/welcome?source=universal` (§7)

**Files:**
- Create: `src/app/welcome/page.tsx`, `src/components/modules/welcome/sources.ts`, `src/components/modules/welcome/cobrand-screen.tsx`, `src/messages/fr/welcome.json`, `src/messages/en/welcome.json`
- Modify: `src/messages/index.ts`

- [ ] **Step 1 : Config des canaux**

`src/components/modules/welcome/sources.ts` :

```ts
/** Les canaux d'acquisition co-brandés. Le contenu textuel est dans messages/<locale>/welcome.json. */
export type WelcomeSource = "universal" | "believe" | "direct";

export type SourceConfig = {
  id: WelcomeSource;
  /** Logo texte du partenaire (initiales ou nom court). */
  logo: string;
  /** Couleur de fond et de texte du logo partenaire. */
  logoBg: string;
  logoFg: string;
  steps: 3;
  /** Nombre de lignes du bloc « ce que cet onboarding résout ». */
  values: number;
  /** Items de la sidebar par défaut (clés de nav.json), et ceux cachés. */
  sidebar: string[];
  hidden: string[];
  /** Persona par défaut au premier écran. */
  persona: "artist" | "label";
  /** Route d'atterrissage après l'onboarding. */
  landing: string;
};

export const SOURCES: Record<WelcomeSource, SourceConfig> = {
  universal: {
    id: "universal",
    logo: "UNIVERSAL",
    logoBg: "#000000",
    logoFg: "#ffffff",
    steps: 3,
    values: 5,
    sidebar: ["roster", "pulse", "streams", "revenue", "contracts", "audit", "arwatch", "rights"],
    hidden: ["urssaf", "fractional"],
    persona: "label",
    landing: "/roster",
  },
  believe: {
    id: "believe",
    logo: "BELIEVE",
    logoBg: "#FFD400",
    logoFg: "#0A0A0F",
    steps: 3,
    values: 4,
    sidebar: ["pulse", "streams", "revenue", "audit", "splits", "rights", "day1index"],
    hidden: ["arwatch", "roster"],
    persona: "artist",
    landing: "/pulse",
  },
  direct: {
    id: "direct",
    logo: "",
    logoBg: "transparent",
    logoFg: "inherit",
    steps: 3,
    values: 3,
    sidebar: ["pulse", "streams", "revenue", "audit"],
    hidden: [],
    persona: "artist",
    landing: "/pulse",
  },
};

export function resolveSource(raw: string | string[] | undefined): SourceConfig {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s && s in SOURCES ? SOURCES[s as WelcomeSource] : SOURCES.direct;
}
```

Vérifier que chaque clé de `sidebar`/`hidden` existe dans `src/messages/fr/nav.json → items` (`grep -c '"arwatch"' src/messages/fr/nav.json` etc.) ; sinon utiliser la clé exacte.

- [ ] **Step 2 : Textes**

`src/messages/fr/welcome.json` :

```json
{
  "brand": "FROM DAY 1",
  "url": "app.from-day1.fr/welcome?source={source}",
  "cta": "Entrer dans le dashboard",
  "switchSource": "Voir un autre canal",
  "valuesTitle": "Ce que cet onboarding résout",
  "sidebarTitle": "Sidebar par défaut",
  "hiddenSuffix": "(caché)",
  "firstInsightLabel": "Premier insight livré en 3 min",
  "sources": {
    "universal": {
      "name": "Universal Music France",
      "welcomeTitle": "Bienvenue, équipes <accent>Universal</accent> — vos artistes voient enfin ce que vous voyez",
      "welcomeBody": "Et vous voyez ce que les plateformes ne vous disent pas. En 3 minutes, on connecte le roster, on cartographie les contrats et on livre le premier brief roster.",
      "offer": "Pilote sur un roster ciblé — 90 jours",
      "steps": {
        "1": { "title": "Connectez le catalogue Universal", "desc": "Roster, contrats, relevés semestriels : import sécurisé, permissions par rôle (label, équipe, artiste)." },
        "2": { "title": "Cartographie contrats & droits", "desc": "Options, recoupements, fins de période, splits, SACEM — chaque échéance devient une alerte, jamais une surprise." },
        "3": { "title": "Recevez le premier brief roster", "desc": "Le Pulse label : signaux de croissance, alertes contractuelles, écarts DSP à réclamer — calibré sur vos données." }
      },
      "firstInsight": "« Sur les 3 artistes du pilote, <accent>{gap}</accent> d'écart estimé / déclaré sur Spotify au dernier trimestre clos — dossier de réclamation DSP prêt. »",
      "values": {
        "1": { "promise": "Transparence des relevés artistes", "delivery": "Rétention, moins de litiges — l'artiste comprend ses gains, en continu" },
        "2": { "promise": "Alertes contractuelles", "delivery": "Options, recoupements, fins de période : aucune échéance ratée" },
        "3": { "promise": "Signaux A&R en continu", "delivery": "Roster piloté à la donnée — momentum, concentration, décrochages" },
        "4": { "promise": "Audit DSP côté label", "delivery": "Récupérer ce que les plateformes sous-paient — réclamation étayée, jamais un conflit interne" },
        "5": { "promise": "Portail artiste co-brandé", "delivery": "UNIVERSAL × FROM DAY 1 : la vue artiste, avec votre logo" }
      }
    },
    "believe": {
      "name": "Believe",
      "welcomeTitle": "Bienvenue parmi les <accent>artistes Believe</accent> sur From Day 1",
      "welcomeBody": "Ismaël Kané (Believe Music Publishing France) t'a recommandé l'outil. En 3 minutes, on importe ton catalogue Believe et on te livre ton premier rapport stratégique.",
      "offer": "3 mois Pro offerts",
      "steps": {
        "1": { "title": "Connecte ton compte Believe", "desc": "OAuth 1 clic. On importe automatiquement tes tracks distribués, tes splits, tes revenus 12 mois." },
        "2": { "title": "Vérifie tes splits et droits FR", "desc": "On détecte tes co-auteurs et propose la sync avec Sentric / Believe Music Publishing pour ton publishing." },
        "3": { "title": "Reçois ton premier Pulse", "desc": "Le brief stratégique du jour calibré sur ta data Believe. Action concrète n°1 à faire aujourd'hui." }
      },
      "firstInsight": "« On a détecté <accent>{gap}</accent> à récupérer sur tes derniers relevés (sous-paiement Spotify). Lettre d'audit prête à envoyer. »",
      "values": {
        "1": { "promise": "Différenciation Believe vs DistroKid", "delivery": "Intelligence + droits FR + audit IA en upsell" },
        "2": { "promise": "Rétention artistes > 50 K auditeurs", "delivery": "Premier insight money-saving en 3 min" },
        "3": { "promise": "Synergie distribution × publishing", "delivery": "Étape 2 : sync Sentric / Believe Publishing" },
        "4": { "promise": "Co-branding visibilité", "delivery": "Logo Believe en header, badge « Artiste Believe »" }
      }
    },
    "direct": {
      "name": "From Day 1",
      "welcomeTitle": "Bienvenue sur <accent>From Day 1</accent>",
      "welcomeBody": "Importe ton relevé distributeur, on te livre ton premier brief en 3 minutes.",
      "offer": "Gratuit pour commencer",
      "steps": {
        "1": { "title": "Importe ton relevé", "desc": "DistroKid, TuneCore, Believe — un CSV, 100 % local." },
        "2": { "title": "Vérifie tes titres et tes splits", "desc": "On reconnaît tes titres et on te propose les splits à signer." },
        "3": { "title": "Reçois ton premier Pulse", "desc": "Streams, gains estimés, écarts à réclamer." }
      },
      "firstInsight": "« Ton premier brief est prêt : <accent>{gap}</accent> d'écart détecté sur ton dernier relevé. »",
      "values": {
        "1": { "promise": "Voir ce que ton label voit", "delivery": "Vue 360° streams / revenus / droits" },
        "2": { "promise": "Récupérer ce qu'on t'a oublié", "delivery": "Audit royalties et lettre prête" },
        "3": { "promise": "Décider chaque matin", "delivery": "Le Pulse quotidien" }
      }
    }
  }
}
```

`src/messages/en/welcome.json` : même structure, textes traduits (mêmes clés, mêmes balises `<accent>` et `{gap}`). Écrire la version anglaise complète — le test de parité échoue sur toute clé manquante.

Dans `src/messages/index.ts`, ajouter les imports `frWelcome` / `enWelcome` et le namespace `welcome` dans les deux objets de messages, en suivant exactement le pattern des autres namespaces du fichier.

- [ ] **Step 3 : L'écran**

`src/components/modules/welcome/cobrand-screen.tsx` :

```tsx
"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SOURCES, type SourceConfig } from "./sources";

export function CobrandScreen({ source, gapEur }: { source: SourceConfig; gapEur: number }) {
  const t = useTranslations("welcome");
  const tn = useTranslations("nav.items");
  const locale = useLocale();
  const s = (key: string, values?: Record<string, string | number>) => t(`sources.${source.id}.${key}`, values);
  const rich = (key: string, values?: Record<string, string | number>) =>
    t.rich(`sources.${source.id}.${key}`, {
      ...values,
      accent: (chunks) => <span className="text-brand">{chunks}</span>,
    });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      {/* Fausse fenêtre navigateur, comme dans le proto */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b bg-surface-2/60 px-4 py-2">
          <span className="size-2.5 rounded-full bg-destructive/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-amber-400/80" aria-hidden />
          <span className="size-2.5 rounded-full bg-emerald-400/80" aria-hidden />
          <span className="ml-3 font-mono text-xs text-muted-foreground">{t("url", { source: source.id })}</span>
        </div>

        <div className="p-6 md:p-10">
          <div className="flex items-center justify-center gap-4">
            {source.logo && (
              <>
                <span
                  className="rounded-md px-3 py-1.5 text-sm font-black tracking-wider"
                  style={{ background: source.logoBg, color: source.logoFg }}
                >
                  {source.logo}
                </span>
                <span className="text-xl text-muted-foreground">×</span>
              </>
            )}
            <span className="rounded-md bg-gradient-to-r from-brand to-chart-2 px-3 py-1.5 text-sm font-black tracking-wider text-background">
              {t("brand")}
            </span>
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-center">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{rich("welcomeTitle")}</h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">{s("welcomeBody")}</p>
            <span className="mt-4 inline-flex rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              {s("offer")}
            </span>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {(["1", "2", "3"] as const).map((n) => (
              <div key={n} className="rounded-xl border bg-surface-2/40 p-4">
                <span className="num text-2xl font-semibold text-brand">{n}</span>
                <h2 className="mt-1 text-sm font-medium">{s(`steps.${n}.title`)}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{s(`steps.${n}.desc`)}</p>
              </div>
            ))}
          </div>

          <div className="brand-glow mt-6 rounded-xl border bg-gradient-to-b from-card to-surface-2 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">{t("firstInsightLabel")}</p>
            <p className="mt-2 text-base leading-relaxed">{rich("firstInsight", { gap: fmtEur(locale, gapEur) })}</p>
          </div>

          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link href={`${source.landing}?persona=${source.persona}`}>
                {t("cta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">{t("valuesTitle")}</h2>
          <ul className="space-y-2 text-sm">
            {Array.from({ length: source.values }, (_, i) => String(i + 1)).map((n) => (
              <li key={n} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-muted-foreground">{s(`values.${n}.promise`)}</span>
                <span aria-hidden>→</span>
                <span>{s(`values.${n}.delivery`)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">{t("sidebarTitle")}</h2>
          <ul className="space-y-1 text-sm">
            {source.sidebar.map((k) => (
              <li key={k} className="rounded-md bg-surface-2/60 px-3 py-1.5">{tn(k)}</li>
            ))}
            {source.hidden.map((k) => (
              <li key={k} className="px-3 py-1.5 text-muted-foreground line-through">
                {tn(k)} <span className="no-underline">{t("hiddenSuffix")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <nav className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t("switchSource")}</span>
        {Object.values(SOURCES).map((o) => (
          <Link
            key={o.id}
            href={`/welcome?source=${o.id}`}
            className={cn("rounded-full border px-2.5 py-1", o.id === source.id && "border-brand text-brand")}
          >
            {t(`sources.${o.id}.name`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

`next-intl` : `t.rich` avec une balise `<accent>` dans le message ; vérifier la syntaxe dans la version installée (`node -e "console.log(require('next-intl/package.json').version)"`, puis la doc « rich text » de cette version). Si `t.rich` n'est pas disponible côté client dans cette version, remplacer `<accent>…</accent>` par un simple `{accent}` et passer la valeur.

- [ ] **Step 4 : La page**

`src/app/welcome/page.tsx` :

```tsx
import { CobrandScreen } from "@/components/modules/welcome/cobrand-screen";
import { resolveSource } from "@/components/modules/welcome/sources";
import { ARTISTS, auditFindings } from "@/lib/demo/api";

/** Écran co-brandé par canal d'acquisition (spec §7). `?source=universal|believe`, sinon direct. */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const source = resolveSource((await searchParams).source);
  // Le « premier insight » cite l'écart d'audit réel du roster (DSP uniquement).
  const gapEur = ARTISTS.flatMap((a) => auditFindings(a.id))
    .filter((f) => f.source.includes("écart"))
    .reduce((s, f) => s + (f.expected - f.reported), 0);
  return <CobrandScreen source={source} gapEur={gapEur} />;
}
```

`auditFindings` lit `getUserData()` (store client) : côté serveur il renvoie `null`, ce qui est le comportement voulu. Si l'import de `api.ts` dans un Server Component pose problème (`"use client"` transitif via `role.tsx` ? — non, `api.ts` n'importe pas `role.tsx`), vérifier avec `npm run build`.

Persona à l'atterrissage : le lien `?persona=label` n'est pas lu aujourd'hui. Ajouter dans `src/lib/role.tsx`, dans le premier `useEffect`, avant la lecture du localStorage :

```ts
      const fromUrl = new URLSearchParams(window.location.search).get("persona");
      if (fromUrl === "artist" || fromUrl === "label") {
        setPersonaState(fromUrl);
        setHydrated(true);
        return;
      }
```

- [ ] **Step 5 : Build, tests, lint**

Run: `npm test && npm run lint && npm run build`
Attendu : tout vert, `/welcome` listée dans les routes (dynamique, à cause de `searchParams`).

- [ ] **Step 6 : Vérifier dans le navigateur**

`/welcome?source=universal` : bandeau UNIVERSAL × FROM DAY 1, 3 étapes, insight avec un montant, bloc valeurs à 5 lignes, sidebar par défaut ; `/welcome?source=believe` : la version Believe ; `/welcome` : direct. Le CTA Universal mène à `/roster` en vue label. Tester les 3 thèmes et le mode mobile (`resize_window`).

- [ ] **Step 7 : Commit**

```bash
git add src/app/welcome src/components/modules/welcome src/messages src/lib/role.tsx && git commit -m "feat(welcome): onboarding co-brandé par canal — Universal, Believe, direct

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13 : Universal dans le pipeline partenaires

**Files:**
- Modify: `src/components/modules/pitch/partner-board.tsx:50-140`, `src/messages/{fr,en}/onboardings.json`

- [ ] **Step 1 : Le partenaire**

Dans `partner-board.tsx`, ajouter `| "universal"` à `PartnerId`, et en tête de `PARTNERS` :

```ts
  {
    id: "universal",
    initials: "UM",
    ownerId: "gael",
    due: "2026-09-18",
    priority: true,
    pilotM3: true,
    riskCount: 2,
    initialStatus: "discussion",
  },
```

- [ ] **Step 2 : Textes**

`src/messages/fr/onboardings.json`, dans `"partners"` :

```json
    "universal": {
      "name": "Universal Music France",
      "tag": "Major",
      "brings": "Le premier roster de France, les relevés DSP directs, la caution d'une major",
      "weBring": "Transparence relevés artistes, alertes contrats, audit DSP, portail artiste co-brandé",
      "nextAction": "Présentation du 18/09 — démo Dadju / Nono / Kiko sur données réelles",
      "pitch": "Universal détient la donnée, ses artistes ne la voient pas, et chaque incompréhension finit en audit contradictoire. From Day 1 pose une couche de transparence au-dessus du label : l'artiste voit ses gains en continu, l'équipe voit les échéances, le label récupère ce que les plateformes sous-paient. Pilote sur un roster ciblé, 90 jours, avec les relevés réels.",
      "m3": "Pilote signé sur un roster ciblé, relevés connectés",
      "m9": "Portail artiste co-brandé déployé, premiers dossiers de réclamation DSP",
      "m18": "Extension au roster France, intégration contrats & droits",
      "risks": {
        "r1": {
          "risk": "L'audit perçu comme un audit du label lui-même",
          "mitigation": "Périmètre contractuel : l'écart est toujours attribué au DSP ; le label est le demandeur, jamais l'audité"
        },
        "r2": {
          "risk": "Cycle de décision long, sécurité des données",
          "mitigation": "Pilote borné, hébergement France, DPA dès le pilote, données jamais revendues"
        }
      }
    },
```

Même bloc traduit dans `en/onboardings.json`. Mettre à jour `kpis.targetedHint` : fr `"8 canaux, un owner chacun"`, en équivalent.

- [ ] **Step 3 : Tests, lint, vérif**

Run: `npm test && npm run lint` puis `/onboardings` en dev : la carte Universal apparaît en « En discussion », priorité absolue, dialogue complet.

- [ ] **Step 4 : Commit**

```bash
git add src/components/modules/pitch/partner-board.tsx src/messages && git commit -m "feat(onboardings): Universal, 8ᵉ canal du pipeline partenaires

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14 : Audit visuel, déploiement, répétition

**Files:**
- Modify: `e2e/visual-audit.spec.ts` (ajouter `/welcome?source=universal`, `/welcome?source=believe` à la liste des pages)
- Create: `docs/superpowers/qa/2026-09-17-audit-visuel.md`, `docs/superpowers/qa/demo-universal-parcours.md`

- [ ] **Step 1 : Ajouter les nouvelles pages à l'audit visuel**

Ouvrir `e2e/visual-audit.spec.ts`, trouver la liste des routes, ajouter `"/welcome?source=universal"` et `"/welcome?source=believe"`.

- [ ] **Step 2 : Lancer l'audit sur les 3 thèmes**

Run: `npm run build && npm run test:e2e 2>&1 | tail -30`
Attendu : toutes les pages capturées, aucune erreur console. Regarder **chaque** capture des pages touchées (Pulse artiste/label, Revenus, Streams, Audience, Audit, Roster, Welcome × 2) dans `e2e/screenshots/` : lisibilité des badges dans les 3 thèmes, pas de débordement des tuiles d'estimation en mobile, pas de « NaN » ni de « 0 € » suspect.

- [ ] **Step 3 : Consigner**

`docs/superpowers/qa/2026-09-17-audit-visuel.md` : date, commit, commande, résumé (pages × thèmes OK / KO), captures problématiques et correctifs faits.

- [ ] **Step 4 : Snapshot du jour puis déploiement**

```bash
npm run snapshot && git add src/lib/real/snapshots && git commit -m "data: snapshot $(date -u +%Y-%m-%d)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" && npm test && npm run build && vercel deploy --prod 2>&1 | tail -5
```

Attendu : une URL de production. Puis vérifier **la prod, pas le localhost** :

```bash
for p in /pulse /roster /revenue /audit "/welcome?source=universal"; do printf "%s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' -m 20 "https://deploy-one-tawny-59.vercel.app$p")"; done
```

Attendu : 200 partout (ou 307 vers /pulse pour `/`). Ouvrir la prod dans le navigateur et faire des captures des 7 étapes du parcours (§10 du spec) — les envoyer à Gaël avec `SendUserFile`.

- [ ] **Step 5 : Fiche de répétition**

`docs/superpowers/qa/demo-universal-parcours.md` — le parcours §10, une ligne par écran : URL prod, ce qu'on dit, le chiffre à pointer, la provenance à assumer si on nous la demande. Chronométrer une répétition complète (objectif : 8 minutes) et noter le temps.

- [ ] **Step 6 : Commit**

```bash
git add e2e/visual-audit.spec.ts docs/superpowers/qa && git commit -m "qa: audit visuel 3 thèmes + parcours de démo Universal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15 : Routine quotidienne jusqu'à la démo + export S4A de Kiko (optionnel)

**Files:**
- Create (si l'export arrive) : `src/lib/userdata/parse-s4a.ts`, `src/lib/userdata/__tests__/parse-s4a.test.ts`

- [ ] **Step 1 : Chaque matin (mardi → jeudi), dans cet ordre**

```bash
cd "/Users/cluzelgael/DAY 2/from-day1-dashboard" && npm run snapshot && npm test && git add src/lib/real/snapshots && git commit -m "data: snapshot $(date -u +%Y-%m-%d)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" && npm run build && vercel deploy --prod 2>&1 | tail -3
```

Montrer à Gaël la sortie brute du snapshot (les 3 lignes `auditeurs=… kworbDaily=…`) et un `git diff --stat` des snapshots. Chaque snapshot supplémentaire ajoute un jour **mesuré** aux courbes.

- [ ] **Step 2 : Si Kiko envoie son export Spotify for Artists**

Le CSV S4A « Songs » a la forme `date,song,streams` (une ligne par titre et par jour) — vérifier l'en-tête réel du fichier reçu avant d'écrire le parser (`head -3 fichier.csv`). Écrire d'abord le test :

`src/lib/userdata/__tests__/parse-s4a.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseS4A } from "@/lib/userdata/parse-s4a";

const CSV = `date,song,streams
2026-09-01,Odjo,1840
2026-09-01,Business class,920
2026-09-02,Odjo,1902
2026-09-02,Business class,870
`;

describe("parseS4A", () => {
  it("regroupe par titre et par jour", () => {
    const r = parseS4A(CSV);
    expect(r.byTrack.get("Odjo")).toEqual({ "2026-09-01": 1840, "2026-09-02": 1902 });
    expect(r.days).toEqual(["2026-09-01", "2026-09-02"]);
    expect(r.total).toBe(5532);
  });
  it("ignore les lignes vides et les nombres formatés", () => {
    const r = parseS4A("date,song,streams\n2026-09-01,Odjo,\"1 840\"\n\n");
    expect(r.byTrack.get("Odjo")).toEqual({ "2026-09-01": 1840 });
  });
});
```

Puis `src/lib/userdata/parse-s4a.ts` :

```ts
/** Export Spotify for Artists (Songs → Download CSV) : date, song, streams. */
export type S4AData = { byTrack: Map<string, Record<string, number>>; days: string[]; total: number };

export function parseS4A(csv: string): S4AData {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const iDate = header.indexOf("date");
  const iSong = header.indexOf("song");
  const iStreams = header.indexOf("streams");
  const byTrack = new Map<string, Record<string, number>>();
  const days = new Set<string>();
  let total = 0;
  for (const line of lines.slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const date = cells[iDate];
    const song = cells[iSong];
    const streams = Number(String(cells[iStreams] ?? "").replace(/[^0-9]/g, "")) || 0;
    if (!date || !song) continue;
    const cur = byTrack.get(song) ?? {};
    cur[date] = (cur[date] ?? 0) + streams;
    byTrack.set(song, cur);
    days.add(date);
    total += streams;
  }
  return { byTrack, days: Array.from(days).sort(), total };
}
```

Brancher : dans `real-source.ts → spotifyDailyByTrack`, branche « sans Kworb », si un fichier `src/lib/real/snapshots/kiko/s4a.json` existe (converti une fois depuis le CSV via un petit script Node, structure `{ byTrack: { "Odjo": { "2026-09-01": 1840 } } }`), passer ces jours dans `measured` de `reconstructTrack` — ils deviennent `measured`. Ajouter un test dans `real-source.test.ts` avec une fixture.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/userdata src/lib/real && git commit -m "feat(userdata): parser export Spotify for Artists — jours mesurés pour Kiko

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Auto-revue du plan (faite le 15/09)

**Couverture du spec :** §2 périmètre → Tasks 1–13 ; §3 sources → Task 2 ; §4.1 snapshots → Task 2 ; §4.2 provenance → Tasks 1, 8, 10 ; §4.3 reconstruction → Task 4 ; §4.4 adaptateur/`StreamSource` → Task 8 (l'interface explicite `StreamSource` est réduite aux fonctions `real*` avec paramètre `snapshots` : une future `SoundchartsSource` remplira le même `Record<string, Snapshot[]>` — YAGNI sur une interface formelle) ; §4.5 S4A → Task 15 ; §5.1 estimateur → Tasks 1, 6, 9 ; §5.2 mix → Task 5 ; §5.3 calibration → Tasks 7, 9 ; §5.4 audit → Tasks 7, 9 ; §5.5 Position algo / Index / Pulse → Position algo et Index consomment `api.ts` et reçoivent donc le réel sans changement (à vérifier visuellement en Task 14) ; Pulse → Task 11 ; §6 roster → Task 3 ; §7 canal Universal → Tasks 12, 13 ; §9 vérification → Tasks 0, 14 ; §10 parcours → Task 14 ; §11 calendrier → ordre des tasks.

**Écarts assumés :** le Day 1 Index n'est pas recalculé (formule inchangée, entrées réelles via `api.ts`) — si le temps manque, c'est le premier point à laisser tel quel. `youtube` : sans clé API et sans vidéo connue, le snapshot YouTube reste `null` et le DSP est estimé ; ajouter au moins les ids des clips officiels de Dadju et Nono dans un premier snapshot à la main (`videos: [{videoId, title, channel:"official", views}]`) pour que le delta soit mesuré dès le lendemain.

**Cohérence des types :** `Provenance` défini en Task 1 et utilisé partout ; `DailyEstimate.byDsp[dsp].gross` (Task 1) utilisé en Tasks 6, 9, 11 ; `EstimateSummary.artistShare / grossMaster / publishing` (Task 1) utilisés en Task 11 ; `realTopTracks(artistId, days, limit, today?, snapshots?)` (Task 8) appelé `realTopTracks(artistId, days, limit)` en Task 9 ; `revenueSeries(artistId, months, streamingOverride?)` (Task 9) ; `hasReal` exporté par `api.ts` (Task 9) et utilisé en Task 11.
