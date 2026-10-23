"use client";

/**
 * Briques communes aux pages du mode client (relevés mensuels importés) :
 * libellés, formats, graphique mois par mois, tableau simple.
 */
import { useLocale } from "next-intl";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CustomerInfo } from "@/lib/customer-mode";
import { fmtCompact, fmtEur, fmtMonth } from "@/lib/format";
import type { LabelStatement } from "@/lib/userdata/merge";
import type { MonthPoint } from "@/lib/userdata/statement-insights";
import type { UserData } from "@/lib/userdata/store";

export const DSP_LABEL: Record<string, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube",
  deezer: "Deezer",
  tiktok: "TikTok",
  amazon: "Amazon Music",
  other: "Autres plateformes",
};
export const FORMAT_LABEL: Record<string, string> = { distrokid: "DistroKid", tunecore: "TuneCore", believe: "Believe", generic: "CSV" };

export function useFormats() {
  const locale = useLocale();
  return {
    locale,
    eur: (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 }),
    eurCents: (n: number) =>
      new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n),
    pct: (share: number, sign = false) =>
      new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: sign ? "exceptZero" : "auto" }).format(share),
    compact: (n: number) => fmtCompact(locale, n),
    month: (m: string) => fmtMonth(locale, m),
    /** « avril 2026 » — pour un texte adressé à quelqu'un (message au distributeur). */
    monthLong: (m: string) =>
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)),
    int: (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n),
    country: (code: string) => {
      try {
        return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
      } catch {
        return code;
      }
    },
  };
}

/**
 * Mention de conversion d'un relevé en devise : au taux BCE du mois de chaque vente
 * (moyenne pondérée affichée, source citée comme l'exige la BCE), ou au taux unique saisi.
 */
export function conversionNote(d: UserData): string {
  if (d.sourceCurrency === "EUR") return "";
  const rate = d.eurRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  return d.fx
    ? `, convertis en euros au taux de référence BCE du mois de chaque vente (en moyenne 1 ${d.sourceCurrency} = ${rate} € ; source : BCE, taux inversés par Day 1)`
    : `, convertis en euros au taux saisi à l'import (1 ${d.sourceCurrency} = ${rate} €)`;
}

/** « Relevé TuneCore · sept. 25 → août 26 · importé le 28/09/2026 » */
export function statementLine(d: UserData, month: (m: string) => string, locale: string): string {
  const sorted = [...d.months].sort();
  const period = sorted.length ? `${month(sorted[0])} → ${month(sorted[sorted.length - 1])}` : "";
  return `Relevé ${FORMAT_LABEL[d.format] ?? d.format} · ${period} · importé le ${new Date(d.importedAt).toLocaleDateString(locale)}`;
}

/** « Tout le label · 4 artistes, 3 relevés · mars 2026 → sept. 2026 » */
export function labelLine(d: UserData, month: (m: string) => string): string {
  const s = d.scope;
  const sorted = [...d.months].sort();
  const period = sorted.length ? `${month(sorted[0])} → ${month(sorted[sorted.length - 1])}` : "";
  const n = (k: number, w: string) => `${k} ${w}${k > 1 ? "s" : ""}`;
  return s ? `Tout le label · ${n(s.artists, "artiste")}, ${n(s.withStatement, "relevé")} · ${period}` : period;
}

/**
 * Sélecteur de périmètre (vue label) : « Tout le label » = la même page avec
 * `?perimetre=label` ; un artiste = on le rouvre (cookie) et on revient ici.
 * Navigation complète dans les deux cas : le relevé du label est chargé par le layout
 * (dashboard), que Next ne re-rend pas sur une navigation client.
 */
export function ScopeSelect({ page, scope, customer }: { page: "/revenue" | "/streams"; scope: "artist" | "label"; customer: CustomerInfo }) {
  if (customer.view !== "label") return null;
  return (
    <select
      value={scope === "label" ? "label" : customer.artistId}
      aria-label="Périmètre"
      className="h-9 rounded-md border bg-transparent px-3 text-sm"
      onChange={(e) => {
        const v = e.target.value;
        if (v === "label") window.location.assign(`${page}?perimetre=label`);
        else window.location.assign(`/espace/ouvrir/${v}?vers=${encodeURIComponent(page)}`);
      }}
    >
      <option value="label">Tout le label</option>
      {customer.artists.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

/**
 * Les mois partiels d'un relevé virtuel, expliqués : « avril, mai 2026 : 2 artistes
 * sur 3 (le relevé de Kiko couvre juin 2026 → sept. 2026) ». Null sans mois partiel.
 */
export function coverageNote(points: MonthPoint[], label: LabelStatement, month: (m: string) => string): string | null {
  const partial = points.filter((p) => p.partial && !p.missing);
  if (!partial.length) return null;
  const byCount = new Map<number, string[]>();
  for (const p of partial) {
    const c = label.coverage[p.month] ?? 0;
    byCount.set(c, [...(byCount.get(c) ?? []), p.month]);
  }
  const parts = [...byCount.entries()].map(([c, months]) => `${months.map(month).join(", ")} : ${c} artiste${c > 1 ? "s" : ""} sur ${label.withStatement}`);
  const absent = label.spans.filter((s) => partial.some((p) => p.month < s.from || p.month > s.to));
  const why = absent.length ? ` (${absent.map((s) => `le relevé de ${s.name} couvre ${month(s.from)} → ${month(s.to)}`).join(" ; ")})` : "";
  return `${parts.join(" · ")}${why}. Les mois atténués ne sont pas comparables aux autres.`;
}

/** Les artistes dont le relevé n'a pas tel détail, en une phrase ; null si tous l'ont. */
export function missingDetailLine(label: LabelStatement, what: "platforms" | "titles" | "countries" | "detail"): string | null {
  const names = label.missingDetail.filter((m) => m.what.includes(what)).map((m) => m.name);
  if (!names.length) return null;
  const detail = { platforms: "le détail par plateforme", titles: "le détail par titre", countries: "le détail par pays", detail: "le détail mois par mois" }[what];
  return `${names.join(", ")} : relevé importé avant ${detail}. Réimporte ${names.length > 1 ? "leurs relevés" : "son relevé"} pour le voir ici.`;
}

export function Dot({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/**
 * Une teinte DISTINCTE par plateforme (tokens --chart-*, déclinés par ambiance).
 * La rampe violette de la démo (dspColor) rend trois plateformes empilées
 * indiscernables — constaté le 28/09 sur le graphique mois par mois.
 */
const PLATFORM_COLOR: Record<string, string> = {
  spotify: "var(--chart-1)",
  apple: "var(--chart-4)",
  youtube: "var(--chart-3)",
  deezer: "var(--chart-2)",
  tiktok: "var(--chart-5)",
  amazon: "color-mix(in oklch, var(--chart-2) 50%, var(--chart-5))",
  other: "var(--muted-foreground)",
};
export const platformColor = (dsp: string) => PLATFORM_COLOR[dsp] ?? PLATFORM_COLOR.other;

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/**
 * Barres mois par mois, empilées par plateforme quand le relevé le permet.
 * `kind="revenue"` sans découpage par plateforme : une seule barre (total).
 * Pas d'animation (voir pnl-monthly-chart : un clipPath qui part de zéro laisse
 * le graphique vide si les frames ne tournent pas).
 */
export function MonthBars({ points, kind }: { points: MonthPoint[]; kind: "revenue" | "streams" }) {
  const locale = useLocale();
  const stacked = kind === "streams" || points.some((p) => p.revenueByDsp !== null);
  const dsps = new Set<string>();
  const rows = points.map((p) => {
    const parts = kind === "streams" ? p.streamsByDsp : p.revenueByDsp;
    const row: Record<string, number | string> = { month: p.month };
    if (stacked && parts) {
      for (const [dsp, v] of Object.entries(parts)) {
        row[dsp] = v ?? 0;
        dsps.add(dsp);
      }
    } else {
      row.total = kind === "streams" ? p.streams : p.revenue;
    }
    return row;
  });
  const keys = stacked ? [...dsps] : ["total"];
  const fmt = (v: number) => (kind === "revenue" ? fmtEur(locale, v) : fmtCompact(locale, v));

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(m: string) => fmtMonth(locale, m)}
            minTickGap={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
            width={48}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
            labelFormatter={(m) => fmtMonth(locale, String(m))}
            formatter={(value, name) => [fmt(Number(value)), name === "total" ? (kind === "revenue" ? "Revenus" : "Streams") : (DSP_LABEL[String(name)] ?? String(name))]}
          />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="m"
              fill={k === "total" ? "var(--chart-1)" : platformColor(k)}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            >
              {points.map((p) => (
                <Cell key={p.month} fillOpacity={p.partial ? 0.45 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Légende des plateformes présentes dans le graphique. */
export function PlatformLegend({ dsps }: { dsps: string[] }) {
  return (
    <p className="sheet-ink mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {dsps.map((d) => (
        <span key={d} className="inline-flex items-center gap-1.5">
          <Dot color={platformColor(d)} /> {DSP_LABEL[d] ?? d}
        </span>
      ))}
    </p>
  );
}

/** Tableau simple : première colonne à gauche, les autres alignées à droite (chiffres). */
export function SimpleTable({ head, rows }: { head: string[]; rows: { key: string; cells: React.ReactNode[] }[] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sheet-ink text-left text-xs">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-1 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-current/10">
              {r.cells.map((c, i) => (
                <td key={i} className={`px-1 py-1.5 ${i > 0 ? "num text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
