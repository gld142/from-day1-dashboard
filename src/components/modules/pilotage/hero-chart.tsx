"use client";

/**
 * Le héros de Pulse (variante V2, validée le 22/09).
 *
 * Un vrai graphique — échelle lisible, grille, repères de temps, pic annoté,
 * point du dernier relevé — et le chiffre du jour posé **au centre**, dans une
 * réserve à la teinte de la feuille. Pas une sparkline décorative : le
 * sélecteur de période change réellement la série affichée.
 *
 * Le graphique reste sous le chiffre (pointer-events désactivés sur la
 * réserve) pour que le tooltip de recharts fonctionne partout ailleurs.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Les quatre fenêtres du sélecteur, en jours de relevé. */
export const HERO_RANGES = [7, 30, 90, 365] as const;
export type HeroRange = (typeof HERO_RANGES)[number];

const RANGE_KEY: Record<HeroRange, string> = {
  7: "d7",
  30: "d30",
  90: "d90",
  365: "m12",
};

export function HeroChart({
  /** Série complète (365 jours) ; la fenêtre choisie en découpe la fin. */
  series,
  heading,
  value,
  caption,
  seriesLabel,
  defaultRange = 90,
  onRangeChange,
}: {
  series: ReadonlyArray<{ date: string; streams: number }>;
  heading: ReactNode;
  /** Le chiffre du jour, déjà formaté. */
  value: ReactNode;
  /** Ce qu'il est, sa variation et sa provenance. */
  caption: ReactNode;
  seriesLabel: string;
  defaultRange?: HeroRange;
  onRangeChange?: (range: HeroRange) => void;
}) {
  const t = useTranslations("pulse.hero");
  const locale = useLocale();
  const [range, setRange] = useState<HeroRange>(defaultRange);

  const data = useMemo(() => series.slice(-range), [series, range]);

  /** Le pic de la fenêtre : le seul repère annoté, parce qu'il se raconte. */
  const peak = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((best, d) => (d.streams > best.streams ? d : best), data[0]);
  }, [data]);

  const last = data[data.length - 1] ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        {heading}
        <div className="flex gap-0.5 text-[11px]">
          {HERO_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r);
                onRangeChange?.(r);
              }}
              aria-pressed={r === range}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                r === range
                  ? "text-foreground bg-[color-mix(in_oklab,var(--sheet-line)_18%,transparent)] font-semibold"
                  : "sheet-ink hover:bg-[color-mix(in_oklab,var(--sheet-line)_10%,transparent)]",
              )}
            >
              {t(`ranges.${RANGE_KEY[r]}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-1 h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 26, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pulse-hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--sheet-line)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--sheet-line)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.14} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
              minTickGap={64}
              tickFormatter={(d: string) =>
                fmtDate(locale, d, { day: "numeric", month: "short" })
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
              width={48}
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
              formatter={(v) => [fmtCompact(locale, Number(v)), seriesLabel]}
            />
            <Area
              type="monotone"
              dataKey="streams"
              name={seriesLabel}
              stroke="var(--sheet-line)"
              strokeWidth={2}
              fill="url(#pulse-hero-fill)"
              animationDuration={600}
            />
            {peak ? (
              <ReferenceDot
                x={peak.date}
                y={peak.streams}
                r={4}
                fill="var(--sheet-line)"
                stroke="none"
                label={{
                  value: t("peak", {
                    value: fmtCompact(locale, peak.streams),
                    date: fmtDate(locale, peak.date, {
                      day: "numeric",
                      month: "short",
                    }),
                  }),
                  position: "top",
                  fontSize: 11,
                  fontWeight: 600,
                  fill: "var(--sheet-ink)",
                }}
              />
            ) : null}
            {last ? (
              <ReferenceDot
                x={last.date}
                y={last.streams}
                r={5}
                fill="var(--sheet-line)"
                stroke="none"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>

        {/* Le chiffre du jour, au centre, au-dessus du tracé. */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="sheet-reserve rounded-2xl px-4 py-1.5">
            <p className="text-5xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-6xl">
              {value}
            </p>
            <p className="sheet-ink mt-1 text-[12.5px]">{caption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
