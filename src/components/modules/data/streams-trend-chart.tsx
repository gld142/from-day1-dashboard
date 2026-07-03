"use client";

/**
 * Grand chart de tendance streams — aire en gradient, style Stripe.
 * Reçoit une série déjà agrégée (quotidienne ou hebdomadaire).
 */
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtDate } from "@/lib/format";
import type { DayPoint } from "./derive";

export function StreamsTrendChart({ data }: { data: DayPoint[] }) {
  const locale = useLocale();
  const t = useTranslations("streams");

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="streams-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            minTickGap={32}
            tickFormatter={(d: string) =>
              fmtDate(locale, d, { day: "numeric", month: "short" })
            }
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={44}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={(d) => fmtDate(locale, String(d))}
            formatter={(value) => [
              fmtCompact(locale, Number(value)),
              t("chart.streams"),
            ]}
          />
          <Area
            type="monotone"
            dataKey="streams"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#streams-trend)"
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
