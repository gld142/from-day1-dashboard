"use client";

/**
 * LE tableau roster — comparatif dense façon Bloomberg.
 * Tri simple sur 3 colonnes, ligne cliquable = zoom dashboard sur l'artiste.
 * Signature structure : au tri, les lignes glissent vers leur nouvelle place
 * (transition de layout framer-motion, 250 ms ease-out, pas de fondu) ;
 * désactivé sous prefers-reduced-motion.
 */
import { useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
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

/** TableRow animable : `ref` est une prop ordinaire en React 19, motion la transmet au <tr>. */
const MotionTableRow = motion.create(TableRow);
const ROW_LAYOUT_TRANSITION = { layout: { duration: 0.25, ease: "easeOut" } } as const;

/**
 * En-tête de colonne triable. Défini au niveau du module : à l'intérieur du
 * composant, React le recréait à chaque rendu et le traitait comme un nouveau
 * type à chaque tri.
 */
function SortHead({
  column,
  label,
  className,
  sortKey,
  desc,
  onToggle,
  sortLabel,
}: {
  column: SortKey;
  label: string;
  className?: string;
  sortKey: SortKey;
  desc: boolean;
  onToggle: (key: SortKey) => void;
  sortLabel: string;
}) {
  const active = sortKey === column;
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead className={cn("text-right", className)}>
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-label={sortLabel}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden />
      </button>
    </TableHead>
  );
}

export function RosterTable({
  rows,
  focusedArtistId,
  onFocus,
  bare = false,
}: {
  rows: RosterRow[];
  focusedArtistId: string | null;
  onFocus: (id: string | null) => void;
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
}) {
  const t = useTranslations("roster");
  const locale = useLocale();
  const [sortKey, setSortKey] = useState<SortKey>("revenue12m");
  const [desc, setDesc] = useState(true);
  const reduceMotion = useReducedMotion();

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

  return (
    <div className={bare ? "min-w-0" : "bg-card rounded-xl border"}>
      {!bare && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-2">
          <h2 className="text-sm font-semibold">{t("table.title")}</h2>
          <p className="text-muted-foreground text-[11px]">{t("table.hint")}</p>
        </div>
      )}
      <div className={cn("min-w-0 overflow-x-auto", bare && "mt-1")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={bare ? undefined : "pl-5"}>{t("table.artist")}</TableHead>
              <TableHead>{t("table.stage")}</TableHead>
              <SortHead
                column="streams30d"
                label={t("table.streams30d")}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.streams30d") })}
              />
              <TableHead className="text-right">{t("table.delta30d")}</TableHead>
              <SortHead
                column="revenue12m"
                label={t("table.revenue12m")}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.revenue12m") })}
              />
              <TableHead className="text-right">{t("table.net12m")}</TableHead>
              <TableHead className="text-right">{t("table.margin")}</TableHead>
              <TableHead className="text-right">{t("table.valuation")}</TableHead>
              <SortHead
                column="day1Index"
                label={t("table.index")}
                className={bare ? undefined : "pr-5"}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.index") })}
              />
            </TableRow>
          </TableHeader>
          <LayoutGroup>
            <TableBody>
              {sorted.map((r) => {
                const focused = focusedArtistId === r.id;
                return (
                  <MotionTableRow
                    key={r.id}
                    layout={reduceMotion ? false : "position"}
                    transition={ROW_LAYOUT_TRANSITION}
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
                  </MotionTableRow>
                );
              })}
            </TableBody>
          </LayoutGroup>
        </Table>
      </div>
    </div>
  );
}
