"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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

/** ComposedChart mensuel : revenus (barres) vs dépenses (barres) + ligne nette. */
export function PnlMonthlyChart({ data }: { data: MonthlyPnlPoint[] }) {
  const locale = useLocale();
  const t = useTranslations("finances.chart");

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(m: string) => fmtMonth(locale, m)}
            minTickGap={16}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
            width={44}
          />
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
            animationDuration={600}
          />
          <Bar
            dataKey="expenses"
            name="expenses"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            animationDuration={600}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="net"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
