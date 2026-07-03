"use client";

/**
 * ComposedChart Overview : barres revenus mensuels × ligne streams.
 * Deux axes Y (EUR à gauche, streams à droite), légende maison.
 */
import { useLocale } from "next-intl";
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

export function RevenueStreamsChart({
  data,
  revenueLabel,
  streamsLabel,
  height = 300,
}: {
  data: Array<{ month: string; revenue: number; streams: number }>;
  revenueLabel: string;
  streamsLabel: string;
  height?: number;
}) {
  const locale = useLocale();

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-[3px]"
            style={{ background: "var(--chart-2)" }}
          />
          {revenueLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-3 rounded-full"
            style={{ background: "var(--chart-1)" }}
          />
          {streamsLabel}
        </span>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ov-rev-bars" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.07} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(m: string) => fmtMonth(locale, m)}
            />
            <YAxis
              yAxisId="rev"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              width={52}
              tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
            />
            <YAxis
              yAxisId="str"
              orientation="right"
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
              labelFormatter={(m) => fmtMonth(locale, String(m))}
              formatter={(value, name) => [
                name === revenueLabel
                  ? fmtEur(locale, Number(value))
                  : fmtCompact(locale, Number(value)),
                String(name),
              ]}
            />
            <Bar
              yAxisId="rev"
              dataKey="revenue"
              name={revenueLabel}
              fill="url(#ov-rev-bars)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              animationDuration={600}
            />
            <Line
              yAxisId="str"
              type="monotone"
              dataKey="streams"
              name={streamsLabel}
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
