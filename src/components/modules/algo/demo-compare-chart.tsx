"use client";

/**
 * Comparaison des inédits : barres groupées par dimension de score.
 */
import { useLocale } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEMO_SUB_KEYS, type DemoTrack } from "./discovery-data";

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function demoColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length];
}

export function DemoCompareChart({
  demos,
  dimLabels,
  height = 280,
}: {
  demos: DemoTrack[];
  dimLabels: Record<(typeof DEMO_SUB_KEYS)[number], string>;
  height?: number;
}) {
  const locale = useLocale();
  const data = DEMO_SUB_KEYS.map((k) => ({
    dim: dimLabels[k],
    ...Object.fromEntries(demos.map((d) => [d.title, d.sub[k]])),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="dim"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={30}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            formatter={(value, name) => [
              `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value))}/100`,
              String(name),
            ]}
          />
          {demos.map((d, i) => (
            <Bar
              key={d.id}
              dataKey={d.title}
              fill={demoColor(i)}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              animationDuration={600}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
