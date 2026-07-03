"use client";

/**
 * Grille roster (vue label Overview) : mini-cards artistes cliquables,
 * sparkline 30 j teintée à la couleur signature de l'artiste.
 */
import { useLocale } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { DeltaChip, Sparkline } from "@/components/dashboard/kpi";
import { artistColor, fmtCompact, fmtEur, fmtInt, fmtPct } from "@/lib/format";
import type { RosterRow } from "@/lib/demo/api";

export type RosterCardRow = RosterRow & {
  spark: Array<{ value: number }>;
};

export function RosterGrid({
  rows,
  labels,
  onSelect,
}: {
  rows: RosterCardRow[];
  labels: {
    streams30d: string;
    revenue12m: string;
    margin: string;
    day1Index: string;
    zoom: (name: string) => string;
  };
  onSelect: (artistId: string) => void;
}) {
  const locale = useLocale();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect(r.id)}
          aria-label={labels.zoom(r.name)}
          className="group flex flex-col gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-brand/40 hover:bg-surface-2/40"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <ArtistAvatar artist={r} size="lg" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {r.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.genre}
                </span>
              </span>
            </span>
            <ArrowUpRight
              className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </div>

          <div className="flex items-end justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">
                {labels.streams30d}
              </span>
              <span className="num block text-xl font-semibold tracking-tight">
                {fmtCompact(locale, r.streams30d)}
              </span>
            </span>
            <DeltaChip value={r.delta30d} />
          </div>

          <Sparkline
            data={r.spark}
            color={artistColor(r.hue)}
            height={32}
            id={`roster-${r.id}`}
          />

          <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
            <div className="min-w-0">
              <dt className="truncate text-muted-foreground">{labels.revenue12m}</dt>
              <dd className="num mt-0.5 font-medium">
                {fmtEur(locale, r.revenue12m, { compact: true })}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-muted-foreground">{labels.margin}</dt>
              <dd className="num mt-0.5 font-medium">
                {fmtPct(locale, r.margin, 0)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-muted-foreground">{labels.day1Index}</dt>
              <dd className="num mt-0.5 font-medium">
                {fmtInt(locale, r.day1Index)}
                <span className="text-muted-foreground"> / 100</span>
              </dd>
            </div>
          </dl>
        </button>
      ))}
    </div>
  );
}
