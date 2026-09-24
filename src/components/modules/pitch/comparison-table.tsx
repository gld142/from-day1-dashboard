"use client";

/**
 * Le tableau « vs Concurrents » — 11 capacités × 6 plateformes.
 * Refondu le 24/09 avec la page /comparatif.
 *
 * Deux corrections de fond :
 *
 *  - Le sous-titre annonçait « 12 capacités » alors que la matrice en compte
 *    11 : la douzième ligne est le prix, qui n'est pas une capacité. Le compte
 *    est désormais LU dans la matrice (`comparisonFacts`), donc il ne peut
 *    plus diverger du tableau qu'il décrit.
 *
 *  - La colonne From Day 1 était peinte au violet de marque. Dans une feuille
 *    « tendances », la couleur code la famille d'information, pas le produit :
 *    la colonne prend le filet de la feuille et l'encre du texte courant.
 *
 * Les trois marques restent sémantiques — vert inclus, ambre partiel, gris
 * absent : elles disent un état, pas une décoration.
 */

import { useLocale, useTranslations } from "next-intl";
import { Check, CircleDot, Minus } from "lucide-react";
import { fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cell = "yes" | "partial" | "no";

const PRODUCTS = [
  "fd1",
  "chartmetric",
  "soundcharts",
  "stem",
  "songtrust",
  "artists247",
] as const;

type ProductKey = (typeof PRODUCTS)[number];

export type CapabilityKey =
  | "analytics"
  | "revenue"
  | "frRights"
  | "urssaf"
  | "splits"
  | "audit"
  | "valuation"
  | "ai"
  | "labelView"
  | "french"
  | "fractional";

/** Cellules alignées sur PRODUCTS : [fd1, chartmetric, soundcharts, stem, songtrust, artists247]. */
const MATRIX: Array<{ key: CapabilityKey; cells: Cell[] }> = [
  { key: "analytics", cells: ["yes", "yes", "yes", "partial", "no", "no"] },
  { key: "revenue", cells: ["yes", "no", "no", "partial", "partial", "no"] },
  { key: "frRights", cells: ["yes", "no", "no", "no", "partial", "no"] },
  { key: "urssaf", cells: ["yes", "no", "no", "no", "no", "no"] },
  { key: "splits", cells: ["yes", "no", "no", "yes", "partial", "no"] },
  { key: "audit", cells: ["yes", "no", "no", "no", "no", "no"] },
  { key: "valuation", cells: ["yes", "no", "no", "no", "no", "no"] },
  { key: "ai", cells: ["yes", "partial", "no", "no", "no", "no"] },
  { key: "labelView", cells: ["yes", "yes", "yes", "partial", "no", "no"] },
  { key: "french", cells: ["yes", "no", "no", "no", "no", "no"] },
  { key: "fractional", cells: ["yes", "no", "no", "no", "no", "no"] },
];

export type ComparisonFacts = {
  /** Nombre de capacités comparées — la ligne de prix n'en est pas une. */
  capabilities: number;
  /** Concurrents, c'est-à-dire tout le monde sauf From Day 1. */
  rivals: number;
  /** Capacités qu'aucun concurrent ne couvre entièrement. */
  uncovered: CapabilityKey[];
  /** Capacités qu'au moins un concurrent couvre entièrement. */
  covered: CapabilityKey[];
  /** Le plus grand nombre de capacités pleines chez un seul concurrent. */
  bestRivalCount: number;
  /** Les concurrents qui atteignent ce maximum. */
  bestRivals: ProductKey[];
};

/**
 * Ce que dit la matrice, lu dans la matrice. Aucun de ces chiffres n'est
 * écrit à la main quelque part : le jour où une cellule change, la page
 * change avec elle. C'est la réponse au « 12 capacités » d'avant, qui était
 * une affirmation de plus, vérifiable seulement à la main.
 */
export function comparisonFacts(): ComparisonFacts {
  const rivals = PRODUCTS.slice(1) as ProductKey[];
  const isFull = (cells: Cell[], rivalIndex: number) => cells[rivalIndex + 1] === "yes";

  const uncovered = MATRIX.filter(
    (row) => !rivals.some((_, i) => isFull(row.cells, i)),
  ).map((row) => row.key);

  const perRival = rivals.map((p, i) => ({
    key: p,
    count: MATRIX.filter((row) => isFull(row.cells, i)).length,
  }));
  const bestRivalCount = Math.max(...perRival.map((r) => r.count));

  return {
    capabilities: MATRIX.length,
    rivals: rivals.length,
    uncovered,
    covered: MATRIX.filter((row) => !uncovered.includes(row.key)).map((r) => r.key),
    bestRivalCount,
    bestRivals: perRival.filter((r) => r.count === bestRivalCount).map((r) => r.key),
  };
}

function CellMark({ cell, label }: { cell: Cell; label: string }) {
  const Icon = cell === "yes" ? Check : cell === "partial" ? CircleDot : Minus;
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full",
        cell === "yes" && "bg-success/12 text-success",
        cell === "partial" && "bg-warning/12 text-warning",
        cell === "no" && "text-muted-foreground/40",
      )}
      title={label}
    >
      <Icon className="size-3.5" aria-hidden strokeWidth={cell === "yes" ? 2.5 : 2} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * `bare` : posé dans une feuille, le tableau n'a ni carte, ni bordure, ni
 * titre — la feuille les porte déjà. Même convention que les tableaux de
 * /contracts et /team.
 */
export function ComparisonTable({ bare = false }: { bare?: boolean }) {
  const t = useTranslations("comparatif");
  const locale = useLocale();

  const priceFor = (p: ProductKey) =>
    p === "fd1"
      ? t("table.prices.fd1", {
          low: fmtEur(locale, 19),
          high: fmtEur(locale, 199),
        })
      : t(`table.prices.${p}`);

  /* La colonne From Day 1 se distingue par le filet de la feuille, dilué :
     assez pour suivre la colonne de l'œil, jamais assez pour recouvrir les
     marques vert / ambre qui portent l'information. Hors feuille (bare à
     false) la variable n'existe pas et color-mix retombe sur transparent. */
  const fd1Column = "bg-[color-mix(in_oklab,var(--sheet-line)_10%,transparent)]";

  return (
    <section className={bare ? "min-w-0" : "rise-in bg-card rounded-xl border p-5"}>
      {!bare && (
        <div className="mb-4">
          <h2 className="font-heading text-base font-semibold">{t("table.title")}</h2>
        </div>
      )}

      <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <Check className="text-success size-3.5" aria-hidden />
          {t("table.legend.yes")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleDot className="text-warning size-3.5" aria-hidden />
          {t("table.legend.partial")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="text-muted-foreground/50 size-3.5" aria-hidden />
          {t("table.legend.no")}
        </span>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-175 border-collapse text-sm">
          <thead>
            <tr className="hairline-b">
              <th className="text-muted-foreground w-56 py-3 pr-3 text-left text-[11px] font-medium tracking-wide uppercase">
                {t("table.capability")}
              </th>
              {PRODUCTS.map((p) => (
                <th
                  key={p}
                  className={cn(
                    "px-2 py-3 text-center align-bottom",
                    p === "fd1" && cn("rounded-t-lg", fd1Column),
                  )}
                >
                  <span className="block text-[13px] leading-tight font-semibold">
                    {t(`table.products.${p}`)}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px] leading-tight font-normal">
                    {t(`table.productDesc.${p}`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.key} className="hairline-b">
                <td className="py-2.5 pr-3 text-[13px] leading-snug">
                  {t(`table.rows.${row.key}`)}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={PRODUCTS[i]}
                    className={cn(
                      "px-2 py-2.5 text-center",
                      PRODUCTS[i] === "fd1" && fd1Column,
                    )}
                  >
                    <CellMark cell={cell} label={t(`table.legend.${cell}`)} />
                  </td>
                ))}
              </tr>
            ))}
            {/* Le prix ferme le tableau sans être compté comme une capacité. */}
            <tr>
              <td className="py-3 pr-3 text-[13px] font-medium">{t("table.price")}</td>
              {PRODUCTS.map((p) => (
                <td
                  key={p}
                  className={cn(
                    "px-2 py-3 text-center",
                    p === "fd1" && cn("rounded-b-lg", fd1Column),
                  )}
                >
                  <span
                    className={cn(
                      "num text-[11px] leading-tight",
                      p === "fd1"
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {priceFor(p)}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
