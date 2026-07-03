"use client";

/**
 * Segments de fans — 4 cards (superfans / engagés / occasionnels / dormants)
 * avec effectif, tendance 30 j et part de la fanbase.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Crown, Flame, Headphones, MoonStar } from "lucide-react";
import type { FanSegment } from "@/lib/demo/types";
import { fmtCompact, fmtPct } from "@/lib/format";
import { DeltaChip } from "@/components/dashboard/kpi";
import { Progress } from "@/components/ui/progress";
import { segmentsFor } from "./derive";

const ICONS: Record<FanSegment["id"], typeof Crown> = {
  superfans: Crown,
  engaged: Flame,
  casual: Headphones,
  dormant: MoonStar,
};

const COLORS: Record<FanSegment["id"], string> = {
  superfans: "var(--chart-1)",
  engaged: "var(--chart-2)",
  casual: "var(--chart-3)",
  dormant: "var(--chart-4)",
};

export function FanSegments({ ids }: { ids: string[] }) {
  const locale = useLocale();
  const t = useTranslations("audience");

  const segments = useMemo(() => segmentsFor(ids), [ids]);
  const total = Math.max(
    1,
    segments.reduce((s, seg) => s + seg.count, 0),
  );

  return (
    <section>
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("segments.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("segments.subtitle")}
        </p>
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {segments.map((seg) => {
          const Icon = ICONS[seg.id];
          const share = (seg.count / total) * 100;
          return (
            <div
              key={seg.id}
              className="flex flex-col gap-2 rounded-xl border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="flex size-8 items-center justify-center rounded-lg bg-surface-2"
                  style={{ color: COLORS[seg.id] }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <DeltaChip value={seg.trend} />
              </div>
              <div>
                <div className="num text-2xl font-semibold tracking-tight">
                  {fmtCompact(locale, seg.count)}
                </div>
                <div className="text-sm font-medium">
                  {t(`segments.${seg.id}.label`)}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(`segments.${seg.id}.desc`)}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Progress value={share} className="flex-1" />
                <span className="num text-[11px] text-muted-foreground">
                  {fmtPct(locale, share).replace("+", "")}{" "}
                  {t("segments.ofFanbase")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
