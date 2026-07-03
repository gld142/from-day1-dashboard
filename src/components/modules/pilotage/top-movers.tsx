"use client";

/**
 * Top movers roster (vue label Pulse) : ArtistBadge + streams 30 j + DeltaChip.
 * Chaque ligne est cliquable → zoom sur l'artiste.
 */
import { useLocale } from "next-intl";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip } from "@/components/dashboard/kpi";
import { fmtCompact } from "@/lib/format";
import type { RosterRow } from "@/lib/demo/api";

export function TopMovers({
  rows,
  unitLabel,
  onSelect,
}: {
  rows: RosterRow[];
  unitLabel: string;
  onSelect: (artistId: string) => void;
}) {
  const locale = useLocale();

  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2/60"
          >
            <ArtistBadge artist={r} meta={r.genre} className="min-w-0 flex-1" />
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="num text-sm font-medium leading-tight">
                {fmtCompact(locale, r.streams30d)}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {unitLabel}
              </span>
            </span>
            <DeltaChip value={r.delta30d} className="shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}
