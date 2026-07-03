"use client";

/**
 * LE tableau roster — comparatif dense façon Bloomberg.
 * Tri simple sur 3 colonnes, ligne cliquable = zoom dashboard sur l'artiste.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Focus } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip } from "@/components/dashboard/kpi";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterRow } from "@/lib/demo/api";
import type { CareerStage } from "@/lib/demo/types";
import { fmtCompact, fmtEur, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "streams30d" | "revenue12m" | "day1Index";

const STAGE_TONE: Record<CareerStage, string> = {
  emerging: "bg-brand/10 text-brand",
  developing: "bg-warning/10 text-warning",
  established: "bg-success/10 text-success",
  peak: "bg-muted text-muted-foreground",
};

export function RosterTable({
  rows,
  focusedArtistId,
  onFocus,
}: {
  rows: RosterRow[];
  focusedArtistId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const t = useTranslations("roster");
  const locale = useLocale();
  const [sortKey, setSortKey] = useState<SortKey>("revenue12m");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey],
      ),
    [rows, sortKey, desc],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  function SortHead({
    column,
    label,
    className,
  }: {
    column: SortKey;
    label: string;
    className?: string;
  }) {
    const active = sortKey === column;
    const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <TableHead className={cn("text-right", className)}>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          aria-label={t("table.sort", { column: label })}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
          <Icon className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5">
        <h2 className="text-sm font-semibold">{t("table.title")}</h2>
        <p className="text-[11px] text-muted-foreground">{t("table.hint")}</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t("table.artist")}</TableHead>
              <TableHead>{t("table.stage")}</TableHead>
              <SortHead column="streams30d" label={t("table.streams30d")} />
              <TableHead className="text-right">{t("table.delta30d")}</TableHead>
              <SortHead column="revenue12m" label={t("table.revenue12m")} />
              <TableHead className="text-right">{t("table.net12m")}</TableHead>
              <TableHead className="text-right">{t("table.margin")}</TableHead>
              <TableHead className="text-right">{t("table.valuation")}</TableHead>
              <SortHead column="day1Index" label={t("table.index")} className="pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => {
              const focused = focusedArtistId === r.id;
              return (
                <TableRow
                  key={r.id}
                  onClick={() => onFocus(focused ? null : r.id)}
                  aria-selected={focused}
                  className={cn(
                    "cursor-pointer",
                    focused && "bg-brand/5 hover:bg-brand/10",
                  )}
                >
                  <TableCell className="pl-5">
                    <span className="flex items-center gap-2">
                      <ArtistBadge artist={r} meta={r.genre} />
                      {focused && (
                        <Badge variant="outline" className="gap-1 border-brand/40 text-brand">
                          <Focus aria-hidden />
                          {t("table.focused")}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent", STAGE_TONE[r.careerStage])}>
                      {t(`stage.${r.careerStage}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {fmtCompact(locale, r.streams30d)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaChip value={r.delta30d} />
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {fmtEur(locale, r.revenue12m, { compact: true })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "num text-right font-semibold",
                      r.net12m >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtEur(locale, r.net12m, { compact: true })}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {fmtPct(locale, r.margin)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {fmtEur(locale, r.valuationMid, { compact: true })}
                  </TableCell>
                  <TableCell className="num pr-5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${r.day1Index}%` }}
                        />
                      </span>
                      <span className="font-medium">{r.day1Index}</span>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
