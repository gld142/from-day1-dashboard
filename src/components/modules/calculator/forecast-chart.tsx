"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtEur, fmtMonth } from "@/lib/format";

export type ForecastChartPoint = {
  month: string;
  actual: number | null;
  projected: number | null;
  /** [low, high] pour la bande de confiance (null sur l'historique). */
  band: [number, number] | null;
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/**
 * Historique (ligne pleine) + projection (pointillés) + bande de confiance
 * (range area low→high, chart-1 à 8 %).
 *
 * Aucune animation : recharts fait entrer aires et lignes via un clipPath qui
 * part de zéro, et si les frames ne s'exécutent pas — onglet en arrière-plan,
 * capture hors viewport — le clip reste fermé et le graphique demeure vide.
 */
export function ForecastChart({
  data,
  /** `true` quand le chiffre clé est posé au centre : on lui laisse la place. */
  centeredValue = false,
}: {
  data: ForecastChartPoint[];
  centeredValue?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("calculator.chart");

  const labels: Record<string, string> = {
    actual: t("actual"),
    projected: t("projected"),
    band: t("band"),
  };

  return (
    <div className="h-[230px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: centeredValue ? 22 : 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="forecast-actual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.1} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(m: string) => fmtMonth(locale, m)}
            minTickGap={24}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--sheet-ink, currentColor)" }}
            tickFormatter={(v: number) => fmtCompact(locale, v)}
            width={52}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(m) => fmtMonth(locale, String(m))}
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                return [
                  `${fmtEur(locale, Number(value[0]), { compact: true })} – ${fmtEur(
                    locale,
                    Number(value[1]),
                    { compact: true },
                  )}`,
                  labels[String(name)] ?? String(name),
                ];
              }
              return [
                fmtEur(locale, Number(value)),
                labels[String(name)] ?? String(name),
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="band"
            name="band"
            stroke="none"
            /* La bande d'incertitude prend la teinte de la feuille : elle dit
               l'imprécision, pas une quatrième série. */
            fill="var(--sheet-line, var(--chart-1))"
            fillOpacity={0.14}
            connectNulls={false}
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="actual"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#forecast-actual)"
            connectNulls={false}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name="projected"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
