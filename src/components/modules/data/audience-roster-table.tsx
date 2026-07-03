"use client";

/**
 * Comparatif des fanbases du roster (vue label agrégée).
 * Clic sur une ligne = zoom sur l'artiste (setFocusedArtistId).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ARTISTS, countryBreakdown } from "@/lib/demo/api";
import { fmtCompact, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip } from "@/components/dashboard/kpi";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { followersFor, segmentsFor } from "./derive";

export function AudienceRosterTable() {
  const locale = useLocale();
  const t = useTranslations("audience");
  const { setFocusedArtistId } = useRole();

  const rows = useMemo(
    () =>
      ARTISTS.map((a) => {
        const segs = segmentsFor([a.id]);
        const superfans = segs.find((s) => s.id === "superfans")?.count ?? 0;
        const engaged = segs.find((s) => s.id === "engaged")?.count ?? 0;
        const top = countryBreakdown(a.id, 30)[0];
        return {
          artist: a,
          listeners: a.monthlyListeners,
          followers: followersFor([a.id]),
          superfans,
          engagement:
            a.monthlyListeners === 0
              ? 0
              : ((superfans + engaged) / a.monthlyListeners) * 100,
          growth: a.growthRate * 100,
          topMarket: top ? (locale === "fr" ? top.nameFr : top.nameEn) : "—",
        };
      }).sort((a, b) => b.listeners - a.listeners),
    [locale],
  );

  const maxEngagement = Math.max(1, ...rows.map((r) => r.engagement));

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("roster.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("roster.subtitle")}
        </p>
      </header>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>{t("roster.artist")}</TableHead>
            <TableHead className="text-right">{t("roster.listeners")}</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              {t("roster.followers")}
            </TableHead>
            <TableHead className="text-right">{t("roster.superfans")}</TableHead>
            <TableHead className="w-40 text-right">
              {t("roster.engagement")}
            </TableHead>
            <TableHead className="text-right">{t("roster.growth")}</TableHead>
            <TableHead className="hidden text-right lg:table-cell">
              {t("roster.topMarket")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.artist.id}
              onClick={() => setFocusedArtistId(r.artist.id)}
              className="cursor-pointer"
            >
              <TableCell>
                <ArtistBadge artist={r.artist} meta={r.artist.genre} size="sm" />
              </TableCell>
              <TableCell className="num text-right">
                {fmtCompact(locale, r.listeners)}
              </TableCell>
              <TableCell className="num hidden text-right md:table-cell">
                {fmtCompact(locale, r.followers)}
              </TableCell>
              <TableCell className="num text-right">
                {fmtCompact(locale, r.superfans)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Progress
                    value={(r.engagement / maxEngagement) * 100}
                    className="w-20"
                  />
                  <span className="num w-12 text-right text-xs">
                    {fmtPct(locale, r.engagement).replace("+", "")}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DeltaChip value={r.growth} />
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                {r.topMarket}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
