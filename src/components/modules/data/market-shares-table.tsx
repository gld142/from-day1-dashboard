"use client";

/**
 * Tableau des parts : dimension principale (première cochée) en lignes,
 * deuxième dimension en sous-lignes (5 premières), troisième en pastille sur
 * chaque sous-ligne (sa valeur dominante). Les artistes du roster Day One
 * sont surlignés. Les parts restent rapportées aux 200 titres.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";
import { marketShares, type MarketDimension, type MarketMetric, type MarketShareRow } from "@/lib/demo/api";
import type { MarketGenre, MarketGroup } from "@/lib/real";
import { fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtPoints, fmtShare } from "./market-shared";

/** Lignes principales affichées avant « Voir les N restantes ». */
const PRIMARY_LIMIT = 25;
/** Sous-lignes par ligne principale. */
const SUB_LIMIT = 5;

export function MarketSharesTable({
  dims,
  metric,
  rosterNames,
}: {
  /** Dimensions cochées, dans l'ordre de sélection (1 à 3). */
  dims: MarketDimension[];
  metric: MarketMetric;
  /** Noms (minuscules) des artistes du roster à surligner. */
  rosterNames: ReadonlySet<string>;
}) {
  const t = useTranslations("market");
  const [expanded, setExpanded] = useState(false);

  const [primary, secondary, tertiary] = dims;
  const rows = useMemo(() => marketShares(primary, { metric }), [primary, metric]);
  const visible = expanded ? rows : rows.slice(0, PRIMARY_LIMIT);
  const hidden = rows.length - visible.length;
  const maxShare = Math.max(1e-9, ...rows.map((r) => r.share));

  const labelOf = (dim: MarketDimension, key: string) =>
    dim === "group" ? t(`groups.${key as MarketGroup}`) : dim === "genre" ? t(`genres.${key as MarketGenre}`) : key;
  const isRoster = (dim: MarketDimension, key: string) => dim === "artist" && rosterNames.has(key.toLowerCase());
  const topTrackOf = (dim: MarketDimension, r: MarketShareRow) =>
    r.topTrack ? (dim === "artist" ? r.topTrack.title : `${r.topTrack.artist} — ${r.topTrack.title}`) : "—";

  const deltaTone = (d: number) =>
    d > 0.05 ? "text-success" : d < -0.05 ? "text-destructive" : "text-muted-foreground";

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("table.title", { dims: dims.map((d) => t(`dims.${d}`)).join(t("table.separator")) })}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("table.subtitle", { limit: SUB_LIMIT })}</p>
      </header>

      {/* Largeurs fixes dès md : le tableau tient dans sa carte, les noms se tronquent ;
          en dessous, mise en page automatique (la colonne Nom garderait 0 px) et
          défilement horizontal dans la carte. */}
      <Table className="mt-4 md:table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">{t("table.rank")}</TableHead>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead className="w-20 text-right">{t("table.streams")}</TableHead>
            <TableHead className="w-28 text-right">{t("table.share")}</TableHead>
            <TableHead className="hidden w-14 text-right md:table-cell">{t("table.delta")}</TableHead>
            <TableHead className="hidden w-12 text-right sm:table-cell">{t("table.tracks")}</TableHead>
            <TableHead className="hidden w-44 lg:table-cell">{t("table.topTrack")}</TableHead>
            <TableHead className="w-24 text-right">{t("table.provenance")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((r, i) => (
            <PrimaryRow
              key={r.key}
              rank={i + 1}
              row={r}
              dims={{ primary, secondary, tertiary }}
              metric={metric}
              maxShare={maxShare}
              labelOf={labelOf}
              isRoster={isRoster}
              topTrackOf={topTrackOf}
              deltaTone={deltaTone}
            />
          ))}
        </TableBody>
      </Table>

      {(hidden > 0 || expanded) && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="size-3" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />}
            {expanded ? t("table.showLess") : t("table.showAll", { count: hidden })}
          </Button>
        </div>
      )}
    </section>
  );
}

type Helpers = {
  labelOf: (dim: MarketDimension, key: string) => string;
  isRoster: (dim: MarketDimension, key: string) => boolean;
  topTrackOf: (dim: MarketDimension, r: MarketShareRow) => string;
  deltaTone: (d: number) => string;
};

function PrimaryRow({
  rank,
  row,
  dims,
  metric,
  maxShare,
  ...h
}: {
  rank: number;
  row: MarketShareRow;
  dims: { primary: MarketDimension; secondary?: MarketDimension; tertiary?: MarketDimension };
  metric: MarketMetric;
  maxShare: number;
} & Helpers) {
  const locale = useLocale();
  const t = useTranslations("market");
  const { primary, secondary, tertiary } = dims;

  const subs = useMemo(
    () =>
      secondary
        ? marketShares(secondary, { metric, within: [{ dim: primary, key: row.key }] }).slice(0, SUB_LIMIT)
        : [],
    [secondary, metric, primary, row.key],
  );
  // Troisième dimension : la valeur dominante de chaque sous-ligne, en pastille.
  const chipOf = (sub: MarketShareRow): string | null => {
    if (!secondary || !tertiary) return null;
    const top = marketShares(tertiary, {
      metric,
      within: [
        { dim: primary, key: row.key },
        { dim: secondary, key: sub.key },
      ],
    })[0];
    return top ? h.labelOf(tertiary, top.key) : null;
  };

  const roster = h.isRoster(primary, row.key);

  return (
    <>
      <TableRow className={cn(roster && "bg-brand/8 hover:bg-brand/12")}>
        <TableCell className="num text-muted-foreground">{rank}</TableCell>
        <TableCell className="overflow-hidden font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{h.labelOf(primary, row.key)}</span>
            {roster && (
              <Badge variant="outline" className="h-5 shrink-0 rounded-full border-brand/40 px-2 text-[10px] text-brand">
                {t("table.roster")}
              </Badge>
            )}
          </span>
        </TableCell>
        <TableCell className="num text-right">{fmtCompact(locale, row.streams)}</TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-2">
            <Progress value={(row.share / maxShare) * 100} className="w-12" />
            <span className="num w-12 text-right text-xs">{fmtShare(locale, row.share)}</span>
          </div>
        </TableCell>
        <TableCell className={cn("num hidden text-right text-xs md:table-cell", h.deltaTone(row.delta7d))}>
          {fmtPoints(locale, row.delta7d)}
        </TableCell>
        <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">{row.tracks}</TableCell>
        <TableCell className="hidden overflow-hidden lg:table-cell">
          <span className="flex min-w-0 items-baseline gap-1.5">
            {row.topTrack && <span className="num shrink-0 text-xs text-muted-foreground">#{row.topTrack.rank}</span>}
            <span className="truncate text-muted-foreground">{h.topTrackOf(primary, row)}</span>
          </span>
        </TableCell>
        <TableCell className="text-right">
          <ProvenanceBadge provenance={row.provenance} />
        </TableCell>
      </TableRow>

      {subs.map((s) => {
        const subRoster = h.isRoster(secondary!, s.key);
        const chip = chipOf(s);
        return (
          <TableRow key={`${row.key}:${s.key}`} className={cn("bg-surface-2/30", subRoster && "bg-brand/8 hover:bg-brand/12")}>
            <TableCell />
            <TableCell className="overflow-hidden py-1.5">
              <span className="flex min-w-0 items-center gap-1.5 pl-2 text-sm">
                <CornerDownRight className="size-3 shrink-0 text-muted-foreground/70" aria-hidden />
                <span className="truncate">{h.labelOf(secondary!, s.key)}</span>
                {chip && (
                  <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                    {chip}
                  </Badge>
                )}
                {subRoster && (
                  <Badge variant="outline" className="h-5 shrink-0 rounded-full border-brand/40 px-2 text-[10px] text-brand">
                    {t("table.roster")}
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="num py-1.5 text-right text-sm text-muted-foreground">{fmtCompact(locale, s.streams)}</TableCell>
            <TableCell className="py-1.5">
              <div className="flex items-center justify-end gap-2">
                <Progress value={(s.share / maxShare) * 100} className="w-12 opacity-70" />
                <span className="num w-12 text-right text-xs text-muted-foreground">{fmtShare(locale, s.share)}</span>
              </div>
            </TableCell>
            <TableCell className={cn("num hidden py-1.5 text-right text-xs md:table-cell", h.deltaTone(s.delta7d))}>
              {fmtPoints(locale, s.delta7d)}
            </TableCell>
            <TableCell className="num hidden py-1.5 text-right text-muted-foreground sm:table-cell">{s.tracks}</TableCell>
            <TableCell className="hidden overflow-hidden py-1.5 lg:table-cell">
              <span className="flex min-w-0 items-baseline gap-1.5">
                {s.topTrack && <span className="num shrink-0 text-xs text-muted-foreground">#{s.topTrack.rank}</span>}
                <span className="truncate text-xs text-muted-foreground">{h.topTrackOf(secondary!, s)}</span>
              </span>
            </TableCell>
            <TableCell className="py-1.5 text-right">
              <ProvenanceBadge provenance={s.provenance} />
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
