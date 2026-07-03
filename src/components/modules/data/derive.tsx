/**
 * Dérivations déterministes pour la zone "data" (/streams, /audience).
 * Tout est seedé par artistId via un hash FNV-1a : aucune valeur aléatoire,
 * le serveur et le client produisent exactement les mêmes chiffres.
 */
import {
  countryBreakdown,
  dailyTotals,
  fanSegments,
  getArtist,
  streamsByDsp,
} from "@/lib/demo/api";
import type { CountryStreams, FanSegment } from "@/lib/demo/types";

/* ─────────────────────────── Hash déterministe ─────────────────────────── */

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Valeur stable dans [0, 1) dérivée d'une clé texte. */
export function hash01(key: string): number {
  return hashStr(key) / 4294967296;
}

/* ─────────────────────────── Séries combinées ─────────────────────────── */

export type DayPoint = { date: string; streams: number };

/** Somme des dailyTotals de plusieurs artistes (vue label agrégée). */
export function combinedDailyTotals(ids: string[], days: number): DayPoint[] {
  const byDay = new Map<string, number>();
  for (const id of ids) {
    for (const p of dailyTotals(id, days)) {
      byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.streams);
    }
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }));
}

/**
 * Agrège une série quotidienne en semaines (buckets de 7 jours ancrés sur la
 * fin de période — le bucket le plus récent est toujours complet).
 * Le premier bucket partiel est ignoré pour éviter un faux creux visuel.
 */
export function aggregateWeekly(points: DayPoint[]): DayPoint[] {
  const out: DayPoint[] = [];
  for (let end = points.length; end > 0; end -= 7) {
    const start = Math.max(0, end - 7);
    const chunk = points.slice(start, end);
    if (chunk.length < 7) break;
    out.unshift({
      date: chunk[0].date,
      streams: chunk.reduce((s, p) => s + p.streams, 0),
    });
  }
  return out;
}

/** Répartition DSP agrégée sur plusieurs artistes. */
export function combinedByDsp(ids: string[], days: number) {
  const acc = new Map<string, number>();
  for (const id of ids) {
    for (const r of streamsByDsp(id, days)) {
      acc.set(r.dsp, (acc.get(r.dsp) ?? 0) + r.streams);
    }
  }
  return Array.from(acc.entries())
    .map(([dsp, streams]) => ({ dsp, streams }))
    .sort((a, b) => b.streams - a.streams);
}

/** Territoires agrégés sur plusieurs artistes. */
export function combinedCountries(ids: string[], days: number): CountryStreams[] {
  const m = new Map<string, CountryStreams>();
  for (const id of ids) {
    for (const c of countryBreakdown(id, days)) {
      const prev = m.get(c.iso3);
      m.set(
        c.iso3,
        prev ? { ...prev, streams: prev.streams + c.streams } : { ...c },
      );
    }
  }
  return Array.from(m.values()).sort((a, b) => b.streams - a.streams);
}

/* ─────────────────────────── Fanbase ─────────────────────────── */

/** Segments agrégés : somme des effectifs, tendance pondérée par effectif. */
export function segmentsFor(ids: string[]): FanSegment[] {
  const per = ids.map((id) => fanSegments(id));
  return per[0].map((seg, i) => {
    const count = per.reduce((s, arr) => s + arr[i].count, 0);
    const trend =
      per.reduce((s, arr) => s + arr[i].trend * arr[i].count, 0) /
      Math.max(1, count);
    return { id: seg.id, count, trend };
  });
}

/** Followers estimés : ratio stable par artiste (30–55 % des auditeurs). */
export function followersFor(ids: string[]): number {
  return ids.reduce((sum, id) => {
    const a = getArtist(id);
    return (
      sum +
      Math.round(a.monthlyListeners * (0.3 + hash01(`${id}:followers`) * 0.25))
    );
  }, 0);
}

/** Croissance mensuelle (%) pondérée par audience. */
export function weightedGrowth(ids: string[]): number {
  let w = 0;
  let acc = 0;
  for (const id of ids) {
    const a = getArtist(id);
    w += a.monthlyListeners;
    acc += a.monthlyListeners * a.growthRate;
  }
  return w === 0 ? 0 : (acc / w) * 100;
}

/* ─────────────────────────── Démographie ─────────────────────────── */

export const AGE_LABELS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
const AGE_BASE = [7, 31, 29, 17, 10, 6];

export type Demography = {
  age: Array<{ label: string; pct: number }>;
  gender: { female: number; male: number; nonbinary: number };
};

function demographyOne(id: string): Demography {
  const raw = AGE_BASE.map(
    (b, i) => b * (0.75 + hash01(`${id}:age:${i}`) * 0.6),
  );
  const sum = raw.reduce((s, v) => s + v, 0);
  const female = 38 + hash01(`${id}:gender-f`) * 24;
  const nonbinary = 3 + hash01(`${id}:gender-nb`) * 4;
  return {
    age: AGE_LABELS.map((label, i) => ({ label, pct: (raw[i] / sum) * 100 })),
    gender: { female, male: 100 - female - nonbinary, nonbinary },
  };
}

/** Démographie stable — pondérée par audience quand plusieurs artistes. */
export function demographyFor(ids: string[]): Demography {
  const items = ids.map((id) => ({
    weight: getArtist(id).monthlyListeners,
    d: demographyOne(id),
  }));
  const wsum = Math.max(
    1,
    items.reduce((s, x) => s + x.weight, 0),
  );
  const wavg = (pick: (d: Demography) => number) =>
    items.reduce((s, x) => s + pick(x.d) * x.weight, 0) / wsum;
  return {
    age: AGE_LABELS.map((label, i) => ({
      label,
      pct: wavg((d) => d.age[i].pct),
    })),
    gender: {
      female: wavg((d) => d.gender.female),
      male: wavg((d) => d.gender.male),
      nonbinary: wavg((d) => d.gender.nonbinary),
    },
  };
}

/* ─────────────────────────── Sources de découverte ─────────────────────── */

export type DiscoverySource = "algorithmic" | "editorial" | "playlists" | "ugc";

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  "algorithmic",
  "editorial",
  "playlists",
  "ugc",
];

function discoveryOne(id: string): Record<DiscoverySource, number> {
  const algorithmic = 28 + hash01(`${id}:disc-algo`) * 14;
  const editorial = 13 + hash01(`${id}:disc-edit`) * 10;
  const ugc = 12 + hash01(`${id}:disc-ugc`) * 16;
  return {
    algorithmic,
    editorial,
    ugc,
    playlists: 100 - algorithmic - editorial - ugc,
  };
}

/** Parts fixes par artiste — pondérées par audience en vue agrégée. */
export function discoveryFor(
  ids: string[],
): Array<{ id: DiscoverySource; pct: number }> {
  const items = ids.map((id) => ({
    weight: getArtist(id).monthlyListeners,
    d: discoveryOne(id),
  }));
  const wsum = Math.max(
    1,
    items.reduce((s, x) => s + x.weight, 0),
  );
  return DISCOVERY_SOURCES.map((source) => ({
    id: source,
    pct: items.reduce((s, x) => s + x.d[source] * x.weight, 0) / wsum,
  }));
}

/* ─────────────────────────── Top villes ─────────────────────────── */

const CITY_POOL: Record<string, Array<{ fr: string; en: string; w: number }>> = {
  FRA: [
    { fr: "Paris", en: "Paris", w: 0.34 },
    { fr: "Lyon", en: "Lyon", w: 0.12 },
    { fr: "Marseille", en: "Marseille", w: 0.1 },
    { fr: "Toulouse", en: "Toulouse", w: 0.07 },
    { fr: "Bordeaux", en: "Bordeaux", w: 0.06 },
    { fr: "Lille", en: "Lille", w: 0.06 },
    { fr: "Nantes", en: "Nantes", w: 0.05 },
  ],
  BEL: [
    { fr: "Bruxelles", en: "Brussels", w: 0.4 },
    { fr: "Liège", en: "Liège", w: 0.15 },
  ],
  CHE: [
    { fr: "Genève", en: "Geneva", w: 0.3 },
    { fr: "Lausanne", en: "Lausanne", w: 0.2 },
  ],
  CAN: [
    { fr: "Montréal", en: "Montreal", w: 0.38 },
    { fr: "Toronto", en: "Toronto", w: 0.15 },
  ],
  USA: [
    { fr: "New York", en: "New York", w: 0.2 },
    { fr: "Los Angeles", en: "Los Angeles", w: 0.16 },
    { fr: "Miami", en: "Miami", w: 0.09 },
  ],
  DEU: [
    { fr: "Berlin", en: "Berlin", w: 0.3 },
    { fr: "Hambourg", en: "Hamburg", w: 0.14 },
  ],
  GBR: [
    { fr: "Londres", en: "London", w: 0.42 },
    { fr: "Manchester", en: "Manchester", w: 0.12 },
  ],
  MAR: [
    { fr: "Casablanca", en: "Casablanca", w: 0.4 },
    { fr: "Rabat", en: "Rabat", w: 0.18 },
  ],
  SEN: [{ fr: "Dakar", en: "Dakar", w: 0.6 }],
  CIV: [{ fr: "Abidjan", en: "Abidjan", w: 0.65 }],
  ESP: [
    { fr: "Madrid", en: "Madrid", w: 0.3 },
    { fr: "Barcelone", en: "Barcelona", w: 0.26 },
  ],
  ITA: [
    { fr: "Milan", en: "Milan", w: 0.3 },
    { fr: "Rome", en: "Rome", w: 0.25 },
  ],
  NLD: [{ fr: "Amsterdam", en: "Amsterdam", w: 0.4 }],
  BRA: [{ fr: "São Paulo", en: "São Paulo", w: 0.3 }],
  JPN: [{ fr: "Tokyo", en: "Tokyo", w: 0.5 }],
  MEX: [{ fr: "Mexico", en: "Mexico City", w: 0.4 }],
};

export type CityRow = {
  key: string;
  nameFr: string;
  nameEn: string;
  listeners: number;
};

/** Top villes dérivé du countryBreakdown (part pays × poids ville × jitter seedé). */
export function topCities(ids: string[], limit = 8): CityRow[] {
  const acc = new Map<string, CityRow>();
  for (const id of ids) {
    const a = getArtist(id);
    const bd = countryBreakdown(id, 30);
    const total = Math.max(
      1,
      bd.reduce((s, c) => s + c.streams, 0),
    );
    for (const c of bd) {
      const countryListeners = a.monthlyListeners * (c.streams / total);
      for (const city of CITY_POOL[c.iso3] ?? []) {
        const est = Math.round(
          countryListeners *
            city.w *
            (0.8 + hash01(`${id}:${c.iso3}:${city.en}`) * 0.4),
        );
        const key = `${c.iso3}:${city.en}`;
        const prev = acc.get(key);
        acc.set(key, {
          key,
          nameFr: city.fr,
          nameEn: city.en,
          listeners: (prev?.listeners ?? 0) + est,
        });
      }
    }
  }
  return Array.from(acc.values())
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, limit);
}
