"use client";

/**
 * Jauge circulaire du Day 1 Index et barres de sous-score.
 *
 * Aucune animation d'entrée. Même raison que les graphiques recharts : un arc
 * qui part de zéro et n'est animé qu'au rendu reste vide si les frames ne
 * s'exécutent pas — onglet en arrière-plan, capture hors viewport, machine
 * chargée pendant une démo. Un score qui s'affiche à zéro est pire qu'un score
 * qui ne bouge pas.
 */
import { useLocale, useTranslations } from "next-intl";

export function IndexGauge({
  value,
  size = 190,
  /** Teinte de l'arc ; par défaut l'encre de la feuille qui l'accueille. */
  color = "var(--sheet-line, var(--chart-1))",
}: {
  value: number;
  size?: number;
  color?: string;
}) {
  const t = useTranslations("day1index");
  const locale = useLocale();

  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="color-mix(in oklab, var(--sheet-line, var(--border)) 20%, transparent)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
            Math.round(value),
          )}
        </span>
        <span className="sheet-ink text-xs tabular-nums">{t("gauge.outOf")}</span>
      </div>
    </div>
  );
}

/** Barre horizontale d'un sous-score (0-100). */
export function SubScoreBar({
  label,
  description,
  value,
  color,
  className,
}: {
  label: string;
  description: string;
  value: number;
  color: string;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums">{v}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line,var(--border))_16%,transparent)]">
        <div
          className="h-full rounded-full"
          style={{ background: color, width: `${v}%` }}
        />
      </div>
      <p className="sheet-ink mt-1 text-[11px] leading-snug">{description}</p>
    </div>
  );
}
