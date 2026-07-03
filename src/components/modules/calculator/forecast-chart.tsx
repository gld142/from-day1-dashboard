"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtEur, fmtMonth } from "@/lib/format";

export type ForecastChartPoint = {
  month: string;
  actual: number | null;
  projected: number | null;
  /** [low, high] pour la bande de confiance (null sur l'historique). */
  band: [number, number] | null;
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/**
 * Historique (ligne pleine) + projection (pointillés) + bande de confiance
 * (range area low→high, chart-1 à 8 %).
 */
export function ForecastChart({ data }: { data: ForecastChartPoint[] }) {
  const locale = useLocale();
  const t = useTranslations("calculator.chart");

  const labels: Record<string, string> = {
    actual: t("actual"),
    projected: t("projected"),
    band: t("band"),
  };

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="forecast-actual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(m: string) => fmtMonth(locale, m)}
            minTickGap={24}
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
            labelFormatter={(m) => fmtMonth(locale, String(m))}
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                return [
                  `${fmtEur(locale, Number(value[0]), { compact: true })} – ${fmtEur(
                    locale,
                    Number(value[1]),
                    { compact: true },
                  )}`,
                  labels[String(name)] ?? String(name),
                ];
              }
              return [
                fmtEur(locale, Number(value)),
                labels[String(name)] ?? String(name),
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="band"
            name="band"
            stroke="none"
            fill="var(--chart-1)"
            fillOpacity={0.08}
            connectNulls={false}
            isAnimationActive
            animationDuration={600}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="actual"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#forecast-actual)"
            connectNulls={false}
            dot={false}
            animationDuration={600}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name="projected"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
