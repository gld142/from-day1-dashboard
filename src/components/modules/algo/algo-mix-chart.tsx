"use client";

/**
 * Chart 90 j : part algorithmique vs éditoriale vs organique (3 lignes).
 */
import { useLocale } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDate } from "@/lib/format";
import type { MixPoint } from "./algo-data";

export type MixKey = "algorithmic" | "editorial" | "organic";

export const MIX_COLORS: Record<MixKey, string> = {
  algorithmic: "var(--chart-1)",
  editorial: "var(--chart-2)",
  organic: "var(--chart-3)",
};

const MIX_KEYS: MixKey[] = ["algorithmic", "editorial", "organic"];

export function AlgoMixChart({
  data,
  labels,
  height = 280,
}: {
  data: MixPoint[];
  labels: Record<MixKey, string>;
  height?: number;
}) {
  const locale = useLocale();
  const pct = (v: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v)} %`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            tickFormatter={(v: number) => pct(v)}
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
            formatter={(value, name) => [pct(Number(value)), String(name)]}
          />
          {MIX_KEYS.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={labels[k]}
              stroke={MIX_COLORS[k]}
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
