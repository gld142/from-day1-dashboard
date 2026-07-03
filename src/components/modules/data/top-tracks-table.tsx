"use client";

/**
 * Top titres de la période — tableau dense, part relative en Progress.
 * Colonne artiste affichée uniquement en vue label agrégée.
 */
import { useLocale, useTranslations } from "next-intl";
import type { Artist } from "@/lib/demo/types";
import { fmtCompact, fmtPct } from "@/lib/format";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TrackRow = {
  id: string;
  rank: number;
  title: string;
  project: string;
  artist: Artist;
  streams: number;
  share: number;
};

export function TopTracksTable({
  rows,
  showArtist,
}: {
  rows: TrackRow[];
  showArtist: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("streams");
  const maxShare = Math.max(1, ...rows.map((r) => r.share));

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("tracks.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("tracks.subtitle", { count: rows.length })}
        </p>
      </header>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">{t("tracks.rank")}</TableHead>
            <TableHead>{t("tracks.track")}</TableHead>
            {showArtist && <TableHead>{t("tracks.artist")}</TableHead>}
            <TableHead className="hidden md:table-cell">
              {t("tracks.project")}
            </TableHead>
            <TableHead className="text-right">{t("tracks.streams")}</TableHead>
            <TableHead className="w-36 text-right">
              {t("tracks.share")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="num text-muted-foreground">
                {r.rank}
              </TableCell>
              <TableCell className="max-w-44 truncate font-medium">
                {r.title}
              </TableCell>
              {showArtist && (
                <TableCell>
                  <ArtistBadge artist={r.artist} size="sm" />
                </TableCell>
              )}
              <TableCell className="hidden max-w-40 truncate text-muted-foreground md:table-cell">
                {r.project}
              </TableCell>
              <TableCell className="num text-right">
                {fmtCompact(locale, r.streams)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Progress
                    value={(r.share / maxShare) * 100}
                    className="w-16"
                  />
                  <span className="num w-12 text-right text-xs text-muted-foreground">
                    {fmtPct(locale, r.share).replace("+", "")}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
