"use client";

/**
 * Répartition par plateforme : donut « part par plateforme » (une teinte, la
 * marque) avec le tableau des parts en légende, puis small multiples
 * (sparkline par DSP). Les pastilles du tableau et des tuiles reprennent la
 * couleur de la part dans le donut (rampe de marque, fixe par plateforme).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { streamSeries } from "@/lib/demo/api";
import type { DSP } from "@/lib/demo/types";
import { fmtCompact, fmtPct } from "@/lib/format";
import { DeltaChip, Sparkline } from "@/components/dashboard/kpi";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { aggregateWeekly, type DayPoint } from "./derive";
import { DspShareDonut, dspColor } from "./dsp-share-donut";

type DspRow = {
  dsp: DSP;
  total: number;
  delta: number;
  share: number;
  color: string;
  spark: Array<{ value: number }>;
};

export function DspBreakdown({ ids, days }: { ids: string[]; days: number }) {
  const locale = useLocale();
  const t = useTranslations("streams");

  const rows = useMemo<DspRow[]>(() => {
    const perDsp = new Map<DSP, Map<string, number>>();
    for (const id of ids) {
      for (const p of streamSeries(id, days * 2)) {
        let m = perDsp.get(p.dsp);
        if (!m) {
          m = new Map();
          perDsp.set(p.dsp, m);
        }
        m.set(p.date, (m.get(p.date) ?? 0) + p.streams);
      }
    }
    const base = Array.from(perDsp.entries()).map(([dsp, m]) => {
      const series: DayPoint[] = Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, streams]) => ({ date, streams }));
      const prev = series.slice(0, days);
      const cur = series.slice(days);
      const total = cur.reduce((s, p) => s + p.streams, 0);
      const prevTotal = prev.reduce((s, p) => s + p.streams, 0);
      return {
        dsp,
        total,
        delta: prevTotal === 0 ? 0 : ((total - prevTotal) / prevTotal) * 100,
        spark: (days >= 90 ? aggregateWeekly(cur) : cur).map((p) => ({
          value: p.streams,
        })),
      };
    });
    base.sort((a, b) => b.total - a.total);
    const grand = base.reduce((s, r) => s + r.total, 0);
    return base.map((r) => ({
      ...r,
      share: grand === 0 ? 0 : (r.total / grand) * 100,
      color: dspColor(r.dsp),
    }));
  }, [ids, days]);

  const pct = (n: number) => fmtPct(locale, n).replace("+", "");

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("dsp.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("dsp.subtitle")}</p>
      </header>

      {/* Donut à gauche (≤ 260 px), tableau des parts en légende à droite ;
          empilés sur mobile. */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
        <DspShareDonut rows={rows} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("dsp.platform")}</TableHead>
              <TableHead className="text-right">{t("dsp.streams")}</TableHead>
              <TableHead className="text-right">{t("dsp.delta")}</TableHead>
              <TableHead className="w-44 text-right">{t("dsp.share")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.dsp}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: r.color }}
                    />
                    {t(`dsp.names.${r.dsp}`)}
                  </span>
                </TableCell>
                <TableCell className="num text-right">
                  {fmtCompact(locale, r.total)}
                </TableCell>
                <TableCell className="text-right">
                  <DeltaChip value={r.delta} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={r.share} className="w-24" />
                    <span className="num w-12 text-right text-xs">
                      {pct(r.share)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Tendance — small multiples, une sparkline par DSP */}
      <h3 className="mt-6 text-xs font-medium text-muted-foreground">{t("dsp.trend")}</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {rows.map((r) => (
          <div key={r.dsp} className="rounded-lg border bg-surface-2/30 p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: r.color }}
                />
                <span className="truncate">{t(`dsp.names.${r.dsp}`)}</span>
              </span>
              <DeltaChip value={r.delta} />
            </div>
            <div className="num mt-1 text-lg font-semibold tracking-tight">
              {fmtCompact(locale, r.total)}
            </div>
            <Sparkline
              data={r.spark}
              color={r.color}
              height={28}
              id={`dsp-${r.dsp}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
