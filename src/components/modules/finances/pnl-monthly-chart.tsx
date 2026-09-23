"use client";

/**
 * Revenus, dépenses et résultat net mois par mois.
 *
 * Les barres disent les deux flux, la ligne dit ce qu'il en reste. Trois
 * couleurs seulement, aucune animation : voir le commentaire sur
 * `isAnimationActive` — l'aire et les barres de recharts entrent via un
 * clipPath qui part de zéro, et si les frames ne s'exécutent pas (onglet en
 * arrière-plan, capture hors viewport) le graphique reste vide.
 */
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtEur, fmtMonth } from "@/lib/format";

export type MonthlyPnlPoint = {
  month: string; // "2026-03"
  revenue: number;
  expenses: number;
  net: number;
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/** Les trois séries et leur couleur, pour le graphique et sa légende. */
export const PNL_SERIES = [
  ["revenue", "var(--chart-1)"],
  ["expenses", "var(--chart-4)"],
  ["net", "var(--chart-2)"],
] as const;

export function PnlMonthlyChart({
  data,
  /** `true` quand le chiffre clé est posé au centre : on lui laisse la place. */
  centeredValue = false,
}: {
  data: MonthlyPnlPoint[];
  centeredValue?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("finances.chart");

  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: centeredValue ? 22 : 8, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(m: string) => fmtMonth(locale, m)}
            minTickGap={16}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
            width={48}
          />
          {/* Le zéro : sans lui, un mois déficitaire ne se voit pas. */}
          <ReferenceLine y={0} stroke="var(--sheet-line, var(--border))" strokeOpacity={0.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
            labelFormatter={(m) => fmtMonth(locale, String(m))}
            formatter={(value, name) => [
              fmtEur(locale, Number(value)),
              t(String(name)),
            ]}
          />
          <Bar
            dataKey="revenue"
            name="revenue"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expenses"
            name="expenses"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="net"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
