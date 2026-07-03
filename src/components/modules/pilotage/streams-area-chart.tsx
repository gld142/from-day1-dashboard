"use client";

/**
 * Grand chart aire streams (90 j) — gradient brand, grille discrète.
 */
import { useLocale } from "next-intl";
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

export function StreamsAreaChart({
  data,
  seriesLabel,
  height = 300,
}: {
  data: Array<{ date: string; streams: number }>;
  seriesLabel: string;
  height?: number;
}) {
  const locale = useLocale();

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="pulse-streams-90" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            minTickGap={48}
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
            labelFormatter={(d) =>
              fmtDate(locale, String(d), { day: "numeric", month: "long" })
            }
            formatter={(value) => [fmtCompact(locale, Number(value)), seriesLabel]}
          />
          <Area
            type="monotone"
            dataKey="streams"
            name={seriesLabel}
            stroke="var(--brand)"
            strokeWidth={2}
            fill="url(#pulse-streams-90)"
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
