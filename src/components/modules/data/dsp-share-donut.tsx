"use client";

/**
 * Donut « part par plateforme » de /streams : un anneau, une seule teinte.
 *
 * Couleurs : rampe ordinale de la marque (--ramp-1 … --ramp-6, clarté
 * monotone, dérivée de --brand donc fidèle à la skin), attribuée par
 * plateforme dans un ordre FIXE — la couleur suit la plateforme, pas son rang :
 * changer de période ne repeint pas les parts. Pas d'arc-en-ciel.
 *
 * Légende = le tableau de répartition à côté (mêmes pastilles) ; le centre
 * porte le total et la plateforme en tête. Arcs animés 600 ms ease-out,
 * immobiles sous prefers-reduced-motion. Anneau un peu plus épais en skin
 * artiste.
 */
import { useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DSP } from "@/lib/demo/types";
import { fmtCompact, fmtPct } from "@/lib/format";
import { useSkin, type Skin } from "@/lib/skin";
import { cn } from "@/lib/utils";

/** Ordre fixe des plateformes sur la rampe (du cran le plus marqué au plus doux). */
const DSP_RAMP: readonly DSP[] = [
  "spotify",
  "deezer",
  "apple",
  "youtube",
  "amazon",
  "tiktok",
  "other",
];
const RAMP_STEPS = 6;

/** Couleur d'une plateforme : cran de la rampe de marque, stable quelle que soit la période. */
export function dspColor(dsp: DSP): string {
  const i = DSP_RAMP.indexOf(dsp);
  return `var(--ramp-${Math.min(RAMP_STEPS, (i < 0 ? RAMP_STEPS : i) + 1)})`;
}

/** Épaisseur de l'anneau par skin : structure plus fine, artiste plus généreuse. */
const RING: Record<Skin, { inner: string; outer: string }> = {
  structure: { inner: "64%", outer: "92%" },
  artist: { inner: "58%", outer: "96%" },
};

export type DspShareRow = { dsp: DSP; total: number; share: number };

export function DspShareDonut({
  rows,
  className,
}: {
  /** Parts triées par volume décroissant (la première est en tête). */
  rows: DspShareRow[];
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("streams.dsp");
  const skin = useSkin();
  const reduceMotion = useReducedMotion();
  const ring = RING[skin];

  const total = rows.reduce((s, r) => s + r.total, 0);
  const leader = rows[0];
  const pct = (n: number) => fmtPct(locale, n).replace("+", "");

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[260px]", className)}>
      {/* Le tableau voisin est la légende accessible : l'anneau est décoratif. */}
      <div aria-hidden className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(value, name) => [
                `${fmtCompact(locale, Number(value))} · ${pct(total === 0 ? 0 : (Number(value) / total) * 100)}`,
                t(`names.${String(name)}`),
              ]}
            />
            <Pie
              data={rows}
              dataKey="total"
              nameKey="dsp"
              innerRadius={ring.inner}
              outerRadius={ring.outer}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={!reduceMotion}
              animationBegin={0}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {rows.map((r) => (
                <Cell key={r.dsp} fill={dspColor(r.dsp)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Centre : total, puis la plateforme en tête et sa part. */}
      <div className="pointer-events-none absolute inset-[26%] flex flex-col items-center justify-center text-center">
        <span className="num text-2xl font-semibold tracking-tight">
          {fmtCompact(locale, total)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("centerTotal")}
        </span>
        {leader && (
          <span className="mt-1.5 text-[11px] leading-tight text-muted-foreground">
            {t("leading", { dsp: t(`names.${leader.dsp}`), share: pct(leader.share) })}
          </span>
        )}
      </div>
    </div>
  );
}
