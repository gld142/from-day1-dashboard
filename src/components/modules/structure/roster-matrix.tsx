"use client";

/**
 * Matrice stratégique croissance × marge — chaque artiste est une bulle
 * colorée à sa teinte signature, la taille encode les revenus 12 mois.
 * Les quadrants sont séparés par les médianes du roster (déterministe).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { RosterRow } from "@/lib/demo/api";
import { artistColor, fmtEur, fmtPct } from "@/lib/format";

type Point = {
  id: string;
  name: string;
  hue: number;
  growth: number; // %/mois
  margin: number; // %
  revenue12m: number;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function RosterMatrix({ rows }: { rows: RosterRow[] }) {
  const t = useTranslations("roster");
  const locale = useLocale();

  const points: Point[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        hue: r.hue,
        growth: r.growthRate * 100,
        margin: r.margin,
        revenue12m: r.revenue12m,
      })),
    [rows],
  );

  const medGrowth = useMemo(() => median(points.map((p) => p.growth)), [points]);
  const medMargin = useMemo(() => median(points.map((p) => p.margin)), [points]);

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{t("matrix.title")}</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {t("matrix.subtitle")}
      </p>
      <div className="relative mt-4 h-72">
        {/* Étiquettes de quadrants (haut = marge élevée, droite = croissance élevée) */}
        <span className="pointer-events-none absolute left-14 top-2 z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("matrix.quadrants.cash")}
        </span>
        <span className="pointer-events-none absolute right-3 top-2 z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("matrix.quadrants.stars")}
        </span>
        <span className="pointer-events-none absolute bottom-8 left-14 z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("matrix.quadrants.watch")}
        </span>
        <span className="pointer-events-none absolute bottom-8 right-3 z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {t("matrix.quadrants.bets")}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.07} />
            <XAxis
              type="number"
              dataKey="growth"
              name={t("matrix.growth")}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => fmtPct(locale, v)}
              domain={["auto", "auto"]}
            />
            <YAxis
              type="number"
              dataKey="margin"
              name={t("matrix.margin")}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => fmtPct(locale, v, 0)}
              width={52}
              domain={["auto", "auto"]}
            />
            <ZAxis type="number" dataKey="revenue12m" range={[120, 520]} />
            <ReferenceLine
              x={medGrowth}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={medMargin}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", strokeOpacity: 0.3 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return (
                  <div
                    className="rounded-[10px] border px-3 py-2 text-xs shadow-sm"
                    style={{
                      background: "var(--popover)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <p className="font-semibold">{p.name}</p>
                    <p className="num mt-1 text-muted-foreground">
                      {t("matrix.growth")} ·{" "}
                      <span className="text-foreground">
                        {fmtPct(locale, p.growth)}
                      </span>
                    </p>
                    <p className="num text-muted-foreground">
                      {t("matrix.margin")} ·{" "}
                      <span className="text-foreground">
                        {fmtPct(locale, p.margin)}
                      </span>
                    </p>
                    <p className="num text-muted-foreground">
                      {t("pnl.revenue")} ·{" "}
                      <span className="text-foreground">
                        {fmtEur(locale, p.revenue12m, { compact: true })}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={points} animationDuration={600}>
              {points.map((p) => (
                <Cell
                  key={p.id}
                  fill={artistColor(p.hue)}
                  fillOpacity={0.85}
                  stroke={artistColor(p.hue, { l: 0.75 })}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Légende artistes */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {points.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: artistColor(p.hue) }}
            />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
