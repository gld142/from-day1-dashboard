/**
 * Audit d'un relevé distributeur MENSUEL : ce qui mérite d'être vérifié, en
 * comparant l'artiste à SON PROPRE historique (pas à un modèle de marché).
 *
 * Un signalement est un écart À VÉRIFIER, jamais une créance : les plateformes
 * paient à des taux qui varient (pays, abonnés gratuits/payants), et le dernier
 * mois d'un relevé est souvent incomplet. Les seuils ci-dessous sont des choix
 * produit, affichés sur la page — pas des mesures.
 */
import type { DSP } from "@/lib/demo/types";
import { addMonths } from "./roster";
import type { UserData } from "./store";

/** Sous ce volume, un taux « pour 1 000 streams » ne veut rien dire. */
export const MIN_STREAMS = 1_000;
/** Un mois payé sous 70 % du taux habituel de la plateforme est signalé. */
export const RATE_DROP = 0.7;
/** Il faut au moins 3 mois payés sur une plateforme pour parler de taux habituel. */
export const MIN_HISTORY = 3;

export type AuditFinding =
  | {
      kind: "rate-drop" | "unpaid-streams";
      month: string;
      dsp: DSP;
      streams: number;
      revenue: number;
      /** € pour 1 000 streams : habituel (médiane de l'artiste sur cette plateforme) et ce mois-ci. */
      usualRate: number | null;
      rate: number;
      /** Ce que ces streams auraient rapporté au taux habituel ; null si pas d'historique. */
      expected: number | null;
      gap: number | null;
      /** Dernier mois du relevé : souvent incomplet, à relativiser. */
      lastMonth: boolean;
    }
  | { kind: "missing-month"; month: string }
  | { kind: "unpaid-track"; title: string; streams: number };

export type StatementAudit = {
  /** false : relevé importé avant le détail par plateforme — on ne peut pas auditer. */
  available: boolean;
  findings: AuditFinding[];
  /** Somme des écarts chiffrés (estimés au taux habituel). */
  totalGap: number;
  checked: { platformMonths: number; months: number };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function auditStatement(d: UserData): StatementAudit {
  const sorted = [...d.months].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span: string[] = [];
  if (first) for (let m = first; m <= last; m = addMonths(m, 1)) span.push(m);

  if (!d.revenueByMonthDsp) return { available: false, findings: [], totalGap: 0, checked: { platformMonths: 0, months: span.length } };
  const revDsp = d.revenueByMonthDsp;

  // Taux habituel par plateforme : médiane des mois PAYÉS avec assez de streams.
  const rates = new Map<DSP, number[]>();
  let platformMonths = 0;
  for (const m of span) {
    for (const [dsp, streams] of Object.entries(d.streamsByMonth[m] ?? {}) as [DSP, number][]) {
      if (streams < MIN_STREAMS) continue;
      platformMonths++;
      const revenue = revDsp[m]?.[dsp] ?? 0;
      if (revenue > 0) rates.set(dsp, [...(rates.get(dsp) ?? []), (revenue / streams) * 1000]);
    }
  }
  const usual = new Map<DSP, number>();
  for (const [dsp, list] of rates) if (list.length >= MIN_HISTORY) usual.set(dsp, median(list));

  const money: AuditFinding[] = [];
  for (const m of span) {
    for (const [dsp, streams] of Object.entries(d.streamsByMonth[m] ?? {}) as [DSP, number][]) {
      if (streams < MIN_STREAMS) continue;
      const revenue = revDsp[m]?.[dsp] ?? 0;
      const usualRate = usual.get(dsp) ?? null;
      const rate = (revenue / streams) * 1000;
      const unpaid = revenue <= 0;
      if (!unpaid && (usualRate === null || rate >= usualRate * RATE_DROP)) continue;
      const expected = usualRate === null ? null : round2((streams * usualRate) / 1000);
      money.push({
        kind: unpaid ? "unpaid-streams" : "rate-drop",
        month: m,
        dsp,
        streams,
        revenue: round2(revenue),
        usualRate: usualRate === null ? null : round2(usualRate),
        rate: round2(rate),
        expected,
        gap: expected === null ? null : round2(expected - revenue),
        lastMonth: m === last,
      });
    }
  }
  money.sort((a, b) => ("gap" in b ? (b.gap ?? -1) : -1) - ("gap" in a ? (a.gap ?? -1) : -1));

  const present = new Set(d.months);
  const missing: AuditFinding[] = span.filter((m) => !present.has(m)).map((month) => ({ kind: "missing-month", month }));

  const tracks: AuditFinding[] = d.trackRevenue
    ? Object.entries(d.trackStreams)
        .filter(([title, streams]) => streams >= MIN_STREAMS && (d.trackRevenue?.[title] ?? 0) <= 0)
        .sort(([, a], [, b]) => b - a)
        .map(([title, streams]) => ({ kind: "unpaid-track", title, streams }))
    : [];

  const findings = [...money, ...missing, ...tracks];
  const totalGap = round2(money.reduce((s, f) => s + ("gap" in f && f.gap !== null ? f.gap : 0), 0));
  return { available: true, findings, totalGap, checked: { platformMonths, months: span.length } };
}
