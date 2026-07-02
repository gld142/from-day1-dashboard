"use client";

/**
 * Grammaire KPI façon Stripe :
 * label court · valeur NumberFlow (digit-roll) · chip delta · sparkline.
 */
import NumberFlow from "@number-flow/react";
import { useLocale } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function DeltaChip({
  value,
  className,
  suffix,
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const locale = useLocale();
  const Icon = value > 0.5 ? ArrowUpRight : value < -0.5 ? ArrowDownRight : Minus;
  const tone =
    value > 0.5
      ? "text-success bg-success/10"
      : value < -0.5
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted";
  const label = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
      {suffix ?? "%"}
    </span>
  );
}

export function Sparkline({
  data,
  color = "var(--chart-1)",
  height = 36,
  id,
}: {
  data: Array<{ value: number }>;
  color?: string;
  height?: number;
  id: string;
}) {
  return (
    <div style={{ height }} className="pointer-events-none w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: number;
  format?: "compact" | "eur" | "int" | "pct";
  delta?: number;
  deltaLabel?: string;
  spark?: Array<{ value: number }>;
  sparkColor?: string;
  id: string;
  hero?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  value,
  format = "compact",
  delta,
  deltaLabel,
  spark,
  sparkColor,
  id,
  hero,
  className,
}: KpiCardProps) {
  const locale = useLocale();

  const numberFormat =
    format === "eur"
      ? ({
          style: "currency",
          currency: "EUR",
          notation: "compact",
          maximumFractionDigits: 1,
        } as const)
      : format === "compact"
        ? ({ notation: "compact", maximumFractionDigits: 1 } as const)
        : format === "pct"
          ? ({ maximumFractionDigits: 1 } as const)
          : ({ maximumFractionDigits: 0 } as const);

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors",
        hero && "brand-glow bg-gradient-to-b from-card to-surface-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>
      <div className={cn("num font-semibold tracking-tight", hero ? "text-3xl" : "text-2xl")}>
        <NumberFlow
          value={value}
          format={numberFormat}
          locales={locale}
          suffix={format === "pct" ? " %" : undefined}
        />
      </div>
      {deltaLabel && (
        <span className="text-[11px] text-muted-foreground">{deltaLabel}</span>
      )}
      {spark && spark.length > 1 && (
        <Sparkline data={spark} color={sparkColor} id={id} />
      )}
    </div>
  );
}
