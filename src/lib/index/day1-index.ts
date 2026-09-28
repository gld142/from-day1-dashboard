/**
 * Day 1 Index RÉEL : une note sur 100 CALCULÉE à partir de mesures, formule
 * affichée à l'écran. Chaque dimension dit d'où elle vient ; une dimension sans
 * donnée vaut `null` et sort de la moyenne (la note dit « sur N dimensions
 * mesurées ») — rien n'est deviné.
 *
 * v2 (29/09/2026), d'après les méthodes publiées (Chartmetric, Soundcharts, charts UK,
 * justice.gov pour l'indice de Herfindahl) :
 *  - streams ramenés AU JOUR (février ne passe plus pour une baisse de ~10 %) ;
 *  - croissance sur UN AN dès 15 mois de relevé (neutralise décembre / janvier) ;
 *  - évolutions notées en log, symétriques : ×1,5 = 100, stable = 50, ÷1,5 = 0 ;
 *  - diversité sur les MONTANTS (1 − Herfindahl), plus seulement le nombre de sources.
 *
 * Sources : relevés distributeur importés, registres saisis (droits, concerts, sync).
 */
export type IndexInput = {
  /** mois « AAAA-MM » → streams, toutes plateformes (relevé importé) */
  streamsByMonth: Record<string, number>;
  /** mois « AAAA-MM » → revenus du relevé, en euros */
  revenueByMonth: Record<string, number>;
  rights: { paid_on: string; amount_eur: number }[];
  shows: { show_date: string; fee_eur: number }[];
  sync: { paid_on: string; amount_eur: number }[];
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
const pct = (ratio: number) => {
  const n = ratio - 1;
  return `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 1000) / 10).toLocaleString("fr-FR")} %`;
};
const int = (n: number) => Math.round(n).toLocaleString("fr-FR");
const AVG_MONTH_DAYS = 30.4375;

/** Échelle logarithmique : 10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100. */
export const sizeScore = (monthly: number) => (monthly < 100 ? 0 : clamp(20 * Math.log10(monthly) - 40));
/** Rapport entre deux périodes → note, en log (symétrique) : ×1,5 = 100, ×1 = 50, ÷1,5 = 0. */
export const changeScore = (ratio: number) => (ratio <= 0 ? 0 : clamp(50 + (50 * Math.log(ratio)) / Math.log(1.5)));

const daysIn = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const shiftMonth = (m: string, n: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export function computeDay1Index(input: IndexInput, today: string): Day1Index {
  const months = Object.keys(input.streamsByMonth).filter((m) => input.streamsByMonth[m] > 0).sort();
  const perDay = (m: string) => (input.streamsByMonth[m] ?? 0) / daysIn(m);
  const sumPD = (ms: string[]) => ms.reduce((t, m) => t + perDay(m), 0);
  const last = (n: number, skip = 0) => months.slice(Math.max(0, months.length - n - skip), months.length - skip);
  const statement = "relevés distributeur importés";
  const dims: Dimension[] = [];

  // Taille : écoute moyenne par jour des 3 derniers mois, ramenée à un mois moyen.
  const recent = last(3);
  const monthly = recent.length ? (sumPD(recent) / recent.length) * AVG_MONTH_DAYS : 0;
  dims.push({
    key: "size",
    label: "Taille de l'audience",
    score: recent.length ? sizeScore(monthly) : null,
    measure: recent.length ? `${int(monthly)} streams par mois (moyenne par jour des ${recent.length} derniers mois du relevé, × 30,4)` : null,
    formula: "échelle log : 10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100",
    source: statement,
    missing: recent.length ? null : "Importe un relevé de ton distributeur.",
  });

  // Croissance : sur un an si possible (mêmes 3 mois l'année d'avant), sinon 3 mois contre 3.
  const cur3 = last(3);
  const yearAgo = cur3.map((m) => shiftMonth(m, -12));
  const yoy = cur3.length === 3 && yearAgo.every((m) => (input.streamsByMonth[m] ?? 0) > 0);
  const prev3 = yoy ? yearAgo : last(3, 3);
  const growthOk = yoy || (months.length >= 6 && sumPD(prev3) > 0);
  const growth = growthOk ? sumPD(cur3) / sumPD(prev3) : 1;
  dims.push({
    key: "growth",
    label: "Croissance",
    score: growthOk ? changeScore(growth) : null,
    measure: growthOk
      ? yoy
        ? `${pct(growth)} d'écoute par jour sur les 3 derniers mois contre les mêmes mois un an plus tôt`
        : `${pct(growth)} d'écoute par jour sur les 3 derniers mois contre les 3 précédents`
      : null,
    formula: "évolution en log : ×1,5 = 100, stable = 50, ÷1,5 = 0 (sur un an dès 15 mois de relevé)",
    source: statement,
    missing: growthOk ? null : "Il faut 6 mois de relevés.",
  });

  // Élan : dernier mois contre la moyenne des 3 précédents, par jour.
  const lastMonth = months[months.length - 1];
  const before = last(3, 1);
  const momentumOk = months.length >= 4 && sumPD(before) > 0;
  const momentum = momentumOk ? perDay(lastMonth) / (sumPD(before) / before.length) : 1;
  dims.push({
    key: "momentum",
    label: "Élan récent",
    score: momentumOk ? changeScore(momentum) : null,
    measure: momentumOk ? `${pct(momentum)} d'écoute par jour le dernier mois contre la moyenne des 3 précédents` : null,
    formula: "évolution en log : ×1,5 = 100, stable = 50, ÷1,5 = 0",
    source: statement,
    missing: momentumOk ? null : "Il faut 4 mois de relevés.",
  });

  // Diversité : montants des 12 derniers mois par source, 1 − Herfindahl, ramené à 0–100.
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const within = (d: string) => d > since && d <= today;
  const fromMonth = shiftMonth(today.slice(0, 7), -12);
  const amounts: [string, number][] = [
    ["streaming", Object.entries(input.revenueByMonth).filter(([m]) => m > fromMonth && m <= today.slice(0, 7)).reduce((t, [, v]) => t + Math.max(0, v), 0)],
    ["droits", input.rights.filter((r) => within(r.paid_on)).reduce((t, r) => t + Math.max(0, r.amount_eur), 0)],
    ["concerts", input.shows.filter((s) => within(s.show_date)).reduce((t, s) => t + Math.max(0, s.fee_eur), 0)],
    ["sync", input.sync.filter((s) => within(s.paid_on)).reduce((t, s) => t + Math.max(0, s.amount_eur), 0)],
  ];
  const total = amounts.reduce((t, [, v]) => t + v, 0);
  const active = amounts.filter(([, v]) => v > 0);
  const hhi = total ? amounts.reduce((t, [, v]) => t + (v / total) ** 2, 0) : 1;
  dims.push({
    key: "diversity",
    label: "Sources de revenus",
    score: total ? clamp(((1 - hhi) / 0.75) * 100) : null,
    measure: total ? `${active.map(([k, v]) => `${k} ${Math.round((v / total) * 100)} %`).join(", ")} des revenus sur 12 mois` : null,
    formula: "1 − Σ parts² (indice de Herfindahl) ÷ 0,75 : une seule source = 0, quatre sources égales = 100",
    source: "relevés + droits, concerts et sync saisis",
    missing: total ? null : "Aucun revenu relevé ou saisi sur 12 mois.",
  });

  dims.push({
    key: "loyalty",
    label: "Fidélité des fans",
    score: null,
    measure: null,
    formula: "part de super auditeurs (15 écoutes ou plus en 28 jours, définition Spotify for Artists)",
    source: "export Spotify for Artists",
    missing: "Se calculera avec ton export Spotify for Artists (segments d'auditeurs).",
  });

  const scored = dims.filter((d) => d.score !== null);
  return {
    score: scored.length ? Math.round(scored.reduce((t, d) => t + (d.score as number), 0) / scored.length) : null,
    measured: scored.length,
    dimensions: dims,
  };
}
