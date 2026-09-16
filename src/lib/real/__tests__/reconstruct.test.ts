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

  it("en mode plafond, la veille reste continue avec aujourd'hui", () => {
    // Même cas que « ne dépasse jamais le total » : la réduction se fait par une
    // rampe dans le temps, pas par un facteur uniforme qui ferait sauter le dernier jour.
    const s = reconstructTrack({ key: "y", total: 400_000, dailyNow: 3_000, days: 365, today: TODAY });
    const veille = s[s.length - 2].streams;
    expect(veille).toBeGreaterThanOrEqual(3_000 * 0.75);
    expect(veille).toBeLessThanOrEqual(3_000 * 1.25);
  });

  it("catalogue : aucun rescaling quand Σ brut < 0,95·total", () => {
    // 10 k/j × 364 j = 3,64 M ≪ 47,5 M : la série doit rester au niveau du débit relevé.
    const s = reconstructTrack({ key: "w", total: 50_000_000, dailyNow: 10_000, days: 364, today: TODAY });
    const sum = s.reduce((a, p) => a + p.streams, 0);
    expect(sum).toBeGreaterThanOrEqual(0.9 * 10_000 * 364);
    expect(sum).toBeLessThanOrEqual(1.15 * 10_000 * 364);
    for (const p of s) {
      expect(p.streams).toBeGreaterThanOrEqual(0.8 * 10_000);
      expect(p.streams).toBeLessThanOrEqual(1.25 * 10_000);
    }
  });

  it("sortie dans la fenêtre : la veille reste continue avec aujourd'hui", () => {
    const s = reconstructTrack({
      key: "z", total: 500_000, dailyNow: 2_000, days: 365, today: TODAY, releaseDate: "2026-07-01",
    });
    const veille = s[s.length - 2].streams;
    expect(veille).toBeGreaterThanOrEqual(2_000 * 0.75);
    expect(veille).toBeLessThanOrEqual(2_000 * 1.25);
  });
});

/* ─── Réalisme : la série ne doit pas ressembler à une vague hebdo métronomique ─── */

const SERIE = { total: 50_000_000, dailyNow: 10_000, days: 364, today: TODAY };
const values = (key: string) => reconstructTrack({ key, ...SERIE }).map((p) => p.streams);

/** Ratio max/min des 7 valeurs de chaque semaine (semaine 0 = la plus ancienne). */
function weeklyRatios(v: number[]): number[] {
  const out: number[] = [];
  for (let w = 0; w + 7 <= v.length; w += 7) {
    const s = v.slice(w, w + 7);
    out.push(Math.max(...s) / Math.min(...s));
  }
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdDev = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
function rollingMean(v: number[], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + n <= v.length; i++) out.push(mean(v.slice(i, i + n)));
  return out;
}
function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
/**
 * Médiane des 7 jours qui précèdent `i` (détecteur de pic « vs la semaine
 * d'avant ») : une fenêtre centrée inclurait la traîne du pic et relèverait la
 * base. Aux premiers jours, fenêtre tronquée ; au tout premier, la valeur elle-même.
 */
function trailingMedian(v: number[], i: number): number {
  const s = v.slice(Math.max(0, i - 7), i).sort((a, b) => a - b);
  return s.length > 0 ? s[Math.floor(s.length / 2)] : v[i];
}
const isPeak = (v: number[], i: number) => v[i] > 1.25 * trailingMedian(v, i);

describe("réalisme", () => {
  it("l'amplitude hebdomadaire varie d'une semaine à l'autre", () => {
    // Sur la somme de 20 titres d'un même artiste (la courbe du dashboard), le bruit
    // journalier se moyenne : ce qui reste du ratio max/min d'une semaine, c'est
    // l'amplitude du motif hebdo. Une vague métronomique donnerait 52 ratios quasi égaux.
    const tracks = Array.from({ length: 20 }, (_, k) => values(`a:t${k + 1}`));
    const total = tracks[0].map((_, i) => tracks.reduce((s, t) => s + t[i], 0));
    const ratios = weeklyRatios(total);
    expect(ratios).toHaveLength(52);
    expect(stdDev(ratios)).toBeGreaterThan(0.03);
    // Pas de pic absurde né de la seule saisonnalité.
    for (const r of ratios) expect(r).toBeLessThan(1.6);
  });

  it("une dérive lente et corrélée entre les titres d'un même artiste", () => {
    const t1 = rollingMean(values("a:t1"), 7);
    const t2 = rollingMean(values("a:t2"), 7);
    // Même calendrier, même artiste : les semaines hautes et basses sont partagées.
    expect(pearson(t1, t2)).toBeGreaterThan(0.6);
    // La dérive est visible mais reste modeste (quelques % à ~20 %).
    for (const rm of [t1, t2]) {
      const range = (Math.max(...rm) - Math.min(...rm)) / mean(rm);
      expect(range).toBeGreaterThan(0.04);
      expect(range).toBeLessThan(0.25);
    }
  });

  it("quelques pics ponctuels qui redescendent", () => {
    // Les pics sont propres à chaque titre et modestes (+15 à +40 %) : un pic
    // tombé un lundi creux reste dans le bruit. On juge donc la propriété sur
    // 20 titres : en moyenne quelques jours saillants par titre et par an, jamais
    // plus de 12 sur un titre, jamais aujourd'hui (ancré sur le débit relevé).
    const tracks = Array.from({ length: 20 }, (_, k) => values(`a:t${k + 1}`));
    let total = 0;
    const after: number[] = []; // niveau 5–7 jours après le pic, rapporté au sommet
    for (const v of tracks) {
      const idx = v.map((_, i) => i).filter((i) => isPeak(v, i));
      expect(idx.length).toBeLessThanOrEqual(12);
      expect(idx).not.toContain(v.length - 1);
      total += idx.length;
      for (const i of idx) if (i + 7 < v.length) after.push(mean(v.slice(i + 5, i + 8)) / v[i]);
    }
    expect(total).toBeGreaterThanOrEqual(10);
    expect(total).toBeLessThanOrEqual(160);
    // Et ça redescend : une semaine après, on est en moyenne nettement sous le sommet
    // (un plateau donnerait ≈ 1, un motif hebdo seul ≈ 0,95).
    expect(mean(after)).toBeLessThan(0.9);
  });
});
