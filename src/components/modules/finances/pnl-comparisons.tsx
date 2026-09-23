"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtCompact, fmtEur } from "@/lib/format";

export type YearPnlRow = {
  year: number;
  revenue: number;
  expenses: number;
  net: number;
};

export type SpendRow = { id: string; name: string; amount: number };

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

function truncate(s: string, max = 13): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function SpendBars({ rows, label }: { rows: SpendRow[]; label: string }) {
  const locale = useLocale();
  const t = useTranslations("finances.compare");

  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(s: string) => truncate(s)}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
            width={44}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
            formatter={(value) => [fmtEur(locale, Number(value)), label]}
          />
          <Bar
            dataKey="amount"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Comparaisons P&L : par année (barres groupées), par projet, par titre.
 *
 * `yearNote` dit sur quels mois porte la comparaison d'années. Elle n'est pas
 * facultative dans l'usage : les séries de démo ne remontent qu'à 24 mois, si
 * bien qu'une année de bord de fenêtre n'a que trois mois de données. Posée
 * nue, sa barre passerait pour un effondrement.
 */
export function PnlComparisons({
  byYear,
  byProject,
  byTrack,
  yearNote,
}: {
  byYear: YearPnlRow[];
  byProject: SpendRow[];
  byTrack: SpendRow[];
  yearNote?: ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("finances.compare");

  return (
    <Tabs defaultValue="year">
      <TabsList>
        <TabsTrigger value="year">{t("byYear")}</TabsTrigger>
        <TabsTrigger value="project">{t("byProject")}</TabsTrigger>
        <TabsTrigger value="track">{t("byTrack")}</TabsTrigger>
      </TabsList>

      <TabsContent value="year" className="mt-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={byYear}
              margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeOpacity={0.12} />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
                tickFormatter={(v: number) => fmtCompact(locale, v)}
                width={44}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--muted)", opacity: 0.25 }}
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
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expenses"
                name="expenses"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Bar
                dataKey="net"
                name="net"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="sheet-ink mt-3 flex flex-wrap items-center gap-4 text-xs">
          {(
            [
              ["revenue", "var(--chart-1)"],
              ["expenses", "var(--chart-4)"],
              ["net", "var(--chart-2)"],
            ] as const
          ).map(([key, color]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: color }}
              />
              {t(key)}
            </span>
          ))}
        </div>
        {yearNote ? (
          <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">{yearNote}</p>
        ) : null}
      </TabsContent>

      <TabsContent value="project" className="mt-4">
        <SpendBars rows={byProject} label={t("topSpend")} />
      </TabsContent>

      <TabsContent value="track" className="mt-4">
        <SpendBars rows={byTrack} label={t("topSpend")} />
      </TabsContent>
    </Tabs>
  );
}
