"use client";

/**
 * P&L par artiste — barres groupées revenus / dépenses / net sur 12 mois.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ARTISTS, pnlByArtist } from "@/lib/demo/api";
import { fmtEur } from "@/lib/format";

const SERIES = [
  { key: "revenue", color: "var(--chart-1)" },
  { key: "expenses", color: "var(--chart-4)" },
  { key: "net", color: "var(--chart-2)" },
] as const;

export function RosterPnlBars() {
  const t = useTranslations("roster");
  const locale = useLocale();

  const data = useMemo(
    () =>
      pnlByArtist(12).map((p) => ({
        ...p,
        name: ARTISTS.find((a) => a.id === p.artistId)?.name ?? p.artistId,
      })),
    [],
  );

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("pnl.title")}</h2>
        <div className="flex items-center gap-3">
          {SERIES.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className="size-2 rounded-[3px]"
                style={{ background: s.color }}
              />
              {t(`pnl.${s.key}`)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={3}>
            <CartesianGrid vertical={false} strokeOpacity={0.07} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
              width={64}
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
                fmtEur(locale, Number(value)),
                t(`pnl.${String(name)}`),
              ]}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
