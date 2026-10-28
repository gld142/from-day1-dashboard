"use client";

/**
 * LE tableau roster — comparatif dense façon Bloomberg.
 * Tri simple sur 3 colonnes, ligne cliquable = zoom dashboard sur l'artiste.
 * Signature structure : au tri, les lignes glissent vers leur nouvelle place
 * (transition de layout framer-motion, 250 ms ease-out, pas de fondu) ;
 * désactivé sous prefers-reduced-motion.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Focus } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
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
import {
  DEFAULT_ORG,
  groupRows,
  personName,
  resolveAssignment,
  type OrgGrouping,
  type OrgState,
} from "@/lib/demo/org";
import { isArtistCategory, type CareerStage } from "@/lib/demo/types";
import { fmtCompact, fmtEur, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "streams30d" | "revenue12m" | "day1Index";

/**
 * Colonnes du tableau : artiste (genre et stade dessous, notes du fil à côté), équipe (DA et
 * chef de projet), streams 30 j (variation dessous), revenus 12 m, net 12 m (marge dessous),
 * valo, index. Sept colonnes au lieu de onze : chaque chiffre secondaire vit sous le chiffre
 * qu'il explique. Le `colSpan` des en-têtes de groupe et de l'état vide doit les couvrir
 * toutes (test : roster-table.test.ts).
 */
export const COLS = 7;

/** Le stade en un point de couleur devant son nom, pas en pastille pleine. */
const STAGE_DOT: Record<CareerStage, string> = {
  emerging: "bg-brand",
  developing: "bg-warning",
  established: "bg-success",
  peak: "bg-muted-foreground",
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
  grouped = false,
  notesByArtist = {},
  groupBy = "categorie",
  org = DEFAULT_ORG,
}: {
  rows: RosterRow[];
  focusedArtistId: string | null;
  onFocus: (id: string | null) => void;
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
  /** Un en-tête par groupe (nom, nombre, streams et revenus du groupe), les lignes dessous. */
  grouped?: boolean;
  /** Notes ouvertes du fil par artiste (Task 11) ; absent = colonne vide. */
  notesByArtist?: Record<string, number>;
  /** Clé des groupes quand `grouped` : catégorie (défaut), DA ou pôle (org.ts). */
  groupBy?: OrgGrouping;
  /** Organisation de la maison : noms des DA et de l'équipe, pôles. Défaut = celle de data.ts. */
  org?: OrgState;
}) {
  const t = useTranslations("roster");
  const to = useTranslations("organisation");
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

  /* Les groupes suivent un ordre fixe (catégories ; DA et pôles dans l'ordre de l'organisation) ;
     chaque groupe garde le tri courant et porte ses sous-totaux (org.ts, groupRows — testé).
     Sans `grouped`, un seul groupe anonyme : le tableau d'avant. */
  const groups = useMemo(() => {
    if (!grouped) return [{ key: null as string | null, rows: sorted, count: 0, streams30d: 0, revenue12m: 0 }];
    return groupRows(sorted, groupBy, org);
  }, [grouped, sorted, groupBy, org]);
  const nameOf = (id: string) => personName(org, id) ?? id;
  const groupLabel = (key: string) => {
    if (groupBy === "da") return nameOf(key);
    if (groupBy === "pole") {
      const pole = org.poles.find((p) => p.id === key);
      return pole?.name ?? (pole && to.has(`poles.${key}`) ? to(`poles.${key}`) : key);
    }
    return isArtistCategory(key) ? t(`category.${key}`) : key;
  };

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
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={bare ? "pl-1" : "pl-5"}>{t("table.artist")}</TableHead>
              <TableHead>{to("team.label")}</TableHead>
              <SortHead
                column="streams30d"
                label={t("table.streams30d")}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.streams30d") })}
              />
              <SortHead
                column="revenue12m"
                label={t("table.revenue12m")}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.revenue12m") })}
              />
              <TableHead className="text-right">{t("table.net12m")}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t("table.valuation")}</TableHead>
              <SortHead
                column="day1Index"
                label={t("table.index")}
                className={bare ? "pr-1" : "pr-5"}
                sortKey={sortKey}
                desc={desc}
                onToggle={toggleSort}
                sortLabel={t("table.sort", { column: t("table.index") })}
              />
            </TableRow>
          </TableHeader>
          <LayoutGroup>
            <TableBody>
              {/* Périmètre sans artiste (ex. urbain × un DA qui n'en suit aucun) : un message, pas un corps muet. */}
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} className="text-muted-foreground py-6 text-center text-[12px]">
                    {t("table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {groups.flatMap((g) => [
                g.key && (
                  <TableRow key={`group-${groupBy}-${g.key}`} className="border-b-0 hover:bg-transparent">
                    <TableCell colSpan={COLS} className={cn("pt-5 pb-1.5 text-[11px]", bare ? "pl-1" : "pl-5")}>
                      <span className="text-foreground font-semibold tracking-[0.1em] uppercase">
                        {groupLabel(g.key)}
                      </span>
                      <span className="text-muted-foreground ml-2.5 tabular-nums">
                        {t("group.summary", {
                          count: g.count,
                          streams: fmtCompact(locale, g.streams30d),
                          revenue: fmtEur(locale, g.revenue12m, { compact: true }),
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ),
                ...g.rows.map((r) => {
                  const focused = focusedArtistId === r.id;
                  const team = resolveAssignment(r, org);
                  const notes = notesByArtist[r.id] ?? 0;
                  return (
                    <MotionTableRow
                      key={r.id}
                      layout={reduceMotion ? false : "position"}
                      transition={ROW_LAYOUT_TRANSITION}
                      onClick={() => onFocus(focused ? null : r.id)}
                      aria-selected={focused}
                      className={cn("cursor-pointer", focused && "bg-brand/5 hover:bg-brand/10")}
                    >
                      {/* Artiste : nom, puis genre et stade en gris ; les notes ouvertes du fil à côté. */}
                      <TableCell className={cn("py-2.5", bare ? "pl-1" : "pl-5")}>
                        <span className="flex items-center gap-2.5">
                          <ArtistAvatar artist={r} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{r.name}</span>
                              {notes > 0 && (
                                <Link
                                  href={`/fil?artist=${encodeURIComponent(r.id)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-brand/12 text-brand inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10.5px] leading-4 font-semibold tabular-nums"
                                  aria-label={`${notes} ${t("table.notes").toLowerCase()} · ${r.name}`}
                                  title={`${notes} ${t("table.notes").toLowerCase()}`}
                                >
                                  {notes}
                                </Link>
                              )}
                              {focused && (
                                <Badge variant="outline" className="border-brand/40 text-brand gap-1">
                                  <Focus aria-hidden />
                                  {t("table.focused")}
                                </Badge>
                              )}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]">
                              <span className="truncate">{r.genre}</span>
                              <span aria-hidden>·</span>
                              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STAGE_DOT[r.careerStage])} />
                              {t(`stage.${r.careerStage}`)}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground text-[12px]"
                        title={to("team.tooltip", {
                          da: nameOf(team.daId),
                          projet: nameOf(team.projectLeadId),
                          marketing: nameOf(team.marketingId),
                          juridique: nameOf(team.legalId),
                        })}
                      >
                        {/* Le DA se lit ; toute l'équipe (chef de projet, marketing, juriste) au survol. */}
                        <span className="text-foreground/80 block">{nameOf(team.daId)}</span>
                        <span className="sr-only">{to("team.projectLead", { name: nameOf(team.projectLeadId) })}</span>
                      </TableCell>
                      {/* Streams, et dessous la variation sur 30 jours. */}
                      <TableCell className="text-right tabular-nums">
                        <span className="block font-medium">{fmtCompact(locale, r.streams30d)}</span>
                        <span
                          className={cn(
                            "block text-[11.5px]",
                            r.delta30d >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {fmtPct(locale, r.delta30d)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtEur(locale, r.revenue12m, { compact: true })}
                      </TableCell>
                      {/* Net, et dessous la marge. Rouge seulement quand on perd de l'argent. */}
                      <TableCell className="text-right tabular-nums">
                        <span className={cn("block font-semibold", r.net12m < 0 && "text-destructive")}>
                          {fmtEur(locale, r.net12m, { compact: true })}
                        </span>
                        <span className="text-muted-foreground block text-[11.5px]">{fmtPct(locale, r.margin)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-right tabular-nums lg:table-cell">
                        {fmtEur(locale, r.valuationMid, { compact: true })}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", bare ? "pr-1" : "pr-5")}>
                        <span className="inline-flex items-center gap-2">
                          <span className="bg-foreground/[0.08] h-1 w-10 overflow-hidden rounded-full">
                            <span className="bg-brand block h-full rounded-full" style={{ width: `${r.day1Index}%` }} />
                          </span>
                          <span className="w-6 font-medium">{r.day1Index}</span>
                        </span>
                      </TableCell>
                    </MotionTableRow>
                  );
                }),
              ])}
            </TableBody>
          </LayoutGroup>
        </Table>
      </div>
    </div>
  );
}
