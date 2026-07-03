"use client";

/**
 * Jauge circulaire du Day 1 Index — arc SVG animé via framer-motion,
 * valeur centrale en digit-roll NumberFlow.
 */
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

export function IndexGauge({
  value,
  size = 190,
}: {
  value: number;
  size?: number;
}) {
  const t = useTranslations("day1index");
  const locale = useLocale();

  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
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
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-4xl font-semibold tracking-tight">
          <NumberFlow
            value={Math.round(value)}
            format={{ maximumFractionDigits: 0 }}
            locales={locale}
          />
        </span>
        <span className="num text-xs text-muted-foreground">{t("gauge.outOf")}</span>
      </div>
    </div>
  );
}

/** Barre horizontale animée d'un sous-score (0-100). */
export function SubScoreBar({
  label,
  description,
  value,
  color,
  delay = 0,
}: {
  label: string;
  description: string;
  value: number;
  color: string;
  delay?: number;
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="num text-sm font-semibold">{v}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
        />
      </div>
    </div>
  );
}
