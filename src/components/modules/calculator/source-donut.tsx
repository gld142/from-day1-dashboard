"use client";

import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";
import type { RevenueSource } from "@/lib/demo/types";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

export type SourceSlice = { source: RevenueSource; amount: number };

/** Donut : total projeté ventilé par source de revenus. */
export function SourceDonut({ data }: { data: SourceSlice[] }) {
  const locale = useLocale();
  const t = useTranslations("calculator");

  const total = data.reduce((s, d) => s + d.amount, 0);
  const slices = data.filter((d) => d.amount > 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [
                fmtEur(locale, Number(value)),
                t(`sources.${String(name)}`),
              ]}
            />
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="source"
              innerRadius="64%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={600}
            >
              {slices.map((d, i) => (
                <Cell key={d.source} fill={`var(--chart-${(i % 5) + 1})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">
            {t("donut.total")}
          </span>
          <span className="num text-lg font-semibold tracking-tight">
            {fmtEur(locale, total, { compact: true })}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((d, i) => (
          <li key={d.source} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: `var(--chart-${(i % 5) + 1})` }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {t(`sources.${d.source}`)}
            </span>
            <span className="num text-xs text-muted-foreground">
              {total > 0
                ? fmtPct(locale, (d.amount / total) * 100, 0).replace("+", "")
                : "—"}
            </span>
            <span className="num w-20 text-right font-medium">
              {fmtEur(locale, d.amount, { compact: true })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
