/**
 * Day 1 Index RÉEL : une note sur 100 CALCULÉE à partir de mesures, formule
 * affichée à l'écran. Chaque dimension dit d'où elle vient ; une dimension sans
 * donnée vaut `null` et sort de la moyenne (la note dit « sur N dimensions
 * mesurées ») — rien n'est deviné. Remplace la note écrite à la main de la démo.
 *
 * Sources : relevés distributeur importés (streams par mois), registres saisis
 * (versements de droits, concerts avec cachet, licences sync encaissées).
 */
export type IndexInput = {
  /** mois « AAAA-MM » → streams, toutes plateformes (relevé importé) */
  streamsByMonth: Record<string, number>;
  rights: { paid_on: string }[];
  shows: { show_date: string }[];
  sync: { paid_on: string }[];
};

export type DimensionKey = "size" | "growth" | "momentum" | "diversity" | "loyalty";
export type Dimension = {
  key: DimensionKey;
  label: string;
  score: number | null;
  /** La mesure derrière la note, en clair. */
  measure: string | null;
  formula: string;
  source: string;
  /** Pourquoi la dimension n'est pas mesurée. */
  missing: string | null;
};
export type Day1Index = { score: number | null; measured: number; dimensions: Dimension[] };

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 1000) / 10).toLocaleString("fr-FR")} %`;
const int = (n: number) => Math.round(n).toLocaleString("fr-FR");

/** Échelle logarithmique : 10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100. */
export const sizeScore = (monthly: number) => (monthly < 100 ? 0 : clamp(20 * Math.log10(monthly) - 40));
/** Écart relatif → note : 0 % = 50, +20 % = 70, −50 % ou moins = 0, +50 % ou plus = 100. */
const changeScore = (ratio: number) => clamp(50 + 100 * ratio);

const monthBefore = (today: string, n: number) => {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 7);
};

export function computeDay1Index(input: IndexInput, today: string): Day1Index {
  const months = Object.keys(input.streamsByMonth).filter((m) => input.streamsByMonth[m] > 0).sort();
  const s = (m: string) => input.streamsByMonth[m] ?? 0;
  const last = (n: number, skip = 0) => months.slice(Math.max(0, months.length - n - skip), months.length - skip);
  const sum = (ms: string[]) => ms.reduce((t, m) => t + s(m), 0);
  const statement = "relevés distributeur importés";

  const dims: Dimension[] = [];

  const recent = last(3);
  const avg = recent.length ? sum(recent) / recent.length : 0;
  dims.push({
    key: "size",
    label: "Taille de l'audience",
    score: recent.length ? sizeScore(avg) : null,
    measure: recent.length ? `${int(avg)} streams par mois (moyenne des ${recent.length} derniers mois du relevé)` : null,
    formula: "échelle log : 10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100",
    source: statement,
    missing: recent.length ? null : "Importe un relevé de ton distributeur.",
  });

  const cur3 = last(3);
  const prev3 = last(3, 3);
  const growthOk = months.length >= 6 && sum(prev3) > 0;
  const growth = growthOk ? sum(cur3) / sum(prev3) - 1 : 0;
  dims.push({
    key: "growth",
    label: "Croissance",
    score: growthOk ? changeScore(growth) : null,
    measure: growthOk ? `${pct(growth)} de streams sur les 3 derniers mois contre les 3 précédents` : null,
    formula: "50 + écart en % (0 % = 50, +20 % = 70), borné à 0–100",
    source: statement,
    missing: growthOk ? null : "Il faut 6 mois de relevés.",
  });

  const lastMonth = months[months.length - 1];
  const before = last(3, 1);
  const momentumOk = months.length >= 4 && sum(before) > 0;
  const momentum = momentumOk ? s(lastMonth) / (sum(before) / before.length) - 1 : 0;
  dims.push({
    key: "momentum",
    label: "Élan récent",
    score: momentumOk ? changeScore(momentum) : null,
    measure: momentumOk ? `${pct(momentum)} de streams le dernier mois contre la moyenne des 3 précédents` : null,
    formula: "50 + écart en %, borné à 0–100",
    source: statement,
    missing: momentumOk ? null : "Il faut 4 mois de relevés.",
  });

  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const within = (d: string) => d > since && d <= today;
  const active = [
    ["streaming", months.some((m) => m >= monthBefore(today, 12))],
    ["droits", input.rights.some((r) => within(r.paid_on))],
    ["concerts", input.shows.some((x) => within(x.show_date))],
    ["sync", input.sync.some((x) => within(x.paid_on))],
  ] as const;
  const on = active.filter(([, v]) => v).map(([k]) => k);
  dims.push({
    key: "diversity",
    label: "Sources de revenus",
    score: on.length ? (on.length / 4) * 100 : null,
    measure: on.length ? `${on.length} source${on.length > 1 ? "s" : ""} active${on.length > 1 ? "s" : ""} sur 12 mois : ${on.join(", ")}` : null,
    formula: "sources actives sur 12 mois parmi streaming, droits, concerts, sync ; ÷ 4",
    source: "relevés + droits, concerts et sync saisis",
    missing: on.length ? null : "Aucun revenu relevé ou saisi sur 12 mois.",
  });

  dims.push({
    key: "loyalty",
    label: "Fidélité des fans",
    score: null,
    measure: null,
    formula: "abonnés ÷ auditeurs (Spotify for Artists)",
    source: "export Spotify for Artists",
    missing: "Se calculera avec ton export Spotify for Artists (auditeurs et abonnés).",
  });

  const scored = dims.filter((d) => d.score !== null);
  return {
    score: scored.length ? Math.round(scored.reduce((t, d) => t + (d.score as number), 0) / scored.length) : null,
    measured: scored.length,
    dimensions: dims,
  };
}
