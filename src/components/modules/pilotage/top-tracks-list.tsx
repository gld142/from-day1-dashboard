"use client";

/**
 * Top 5 titres : rang, titre, mini sparkline, streams — aligné droite.
 */
import { useLocale } from "next-intl";
import { Sparkline } from "@/components/dashboard/kpi";
import { fmtCompact } from "@/lib/format";

export type TopTrackRow = {
  id: string;
  title: string;
  streams: number;
  spark: Array<{ value: number }>;
};

export function TopTracksList({ tracks }: { tracks: TopTrackRow[] }) {
  const locale = useLocale();

  return (
    <ol className="space-y-1">
      {tracks.map((t, i) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2/60"
        >
          <span className="num w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {t.title}
          </span>
          <span className="w-20 shrink-0">
            <Sparkline data={t.spark} height={24} id={`track-${t.id}`} />
          </span>
          <span className="num w-14 shrink-0 text-right text-sm font-medium">
            {fmtCompact(locale, t.streams)}
          </span>
        </li>
      ))}
    </ol>
  );
}
