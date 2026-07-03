"use client";

/**
 * Donut répartition streams par DSP + légende détaillée (part en %).
 */
import { useLocale } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtCompact, fmtInt } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function DspDonut({
  data,
  totalLabel,
}: {
  data: Array<{ dsp: string; label: string; streams: number }>;
  totalLabel: string;
}) {
  const locale = useLocale();
  const total = data.reduce((s, d) => s + d.streams, 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                fmtCompact(locale, Number(value)),
                String(name),
              ]}
            />
            <Pie
              data={data}
              dataKey="streams"
              nameKey="label"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={600}
            >
              {data.map((d, i) => (
                <Cell key={d.dsp} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-lg font-semibold tracking-tight">
            {fmtCompact(locale, total)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {totalLabel}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => {
          const share = total === 0 ? 0 : (d.streams / total) * 100;
          return (
            <li key={d.dsp} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="num text-muted-foreground">
                {fmtCompact(locale, d.streams)}
              </span>
              <span className="num w-12 text-right text-xs text-muted-foreground">
                {fmtInt(locale, Math.round(share))} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
