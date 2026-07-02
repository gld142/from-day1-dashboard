/**
 * RNG déterministe (mulberry32) : mêmes données à chaque rendu,
 * côté serveur comme côté client — indispensable pour l'hydration.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** RNG dérivé d'une clé stable ("sky-lune:streams:spotify"). */
export function rngFor(key: string) {
  return mulberry32(hashString(key));
}

/**
 * "Aujourd'hui" figé pour la démo : les séries sont stables d'un jour à
 * l'autre pendant le développement. À brancher sur Date.now() en prod.
 */
export const DEMO_TODAY = new Date("2026-07-02T00:00:00Z");

export function daysAgo(n: number): Date {
  const d = new Date(DEMO_TODAY);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function monthsAgo(n: number): Date {
  const d = new Date(DEMO_TODAY);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}
