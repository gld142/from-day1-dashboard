"use client";

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
          <CartesianGrid vertical={false} strokeOpacity={0.07} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(s: string) => truncate(s)}
            interval={0}
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
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
            formatter={(value) => [fmtEur(locale, Number(value)), label]}
          />
          <Bar
            dataKey="amount"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Comparaisons P&L : par année (barres groupées), par projet, par titre. */
export function PnlComparisons({
  byYear,
  byProject,
  byTrack,
}: {
  byYear: YearPnlRow[];
  byProject: SpendRow[];
  byTrack: SpendRow[];
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
              <CartesianGrid vertical={false} strokeOpacity={0.07} />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
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
                animationDuration={600}
              />
              <Bar
                dataKey="expenses"
                name="expenses"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={600}
              />
              <Bar
                dataKey="net"
                name="net"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
