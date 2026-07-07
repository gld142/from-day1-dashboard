"use client";

/**
 * Tableau comparatif "vs Concurrents" — la pièce maîtresse du pitch :
 * 11 capacités + prix × 6 plateformes. Une seule colonne est pleine.
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

type CapabilityKey =
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

export function ComparisonTable() {
  const t = useTranslations("comparatif");
  const locale = useLocale();

  const priceFor = (p: ProductKey) =>
    p === "fd1"
      ? t("table.prices.fd1", {
          low: fmtEur(locale, 19),
          high: fmtEur(locale, 199),
        })
      : t(`table.prices.${p}`);

  return (
    <section className="rise-in rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">{t("table.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("table.subtitle")}</p>
        </div>
        {/* Légende */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-success" aria-hidden />
            {t("table.legend.yes")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className="size-3.5 text-warning" aria-hidden />
            {t("table.legend.partial")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-3.5 text-muted-foreground/50" aria-hidden />
            {t("table.legend.no")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-175 border-collapse text-sm">
          <thead>
            <tr className="hairline-b">
              <th className="w-56 py-3 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("table.capability")}
              </th>
              {PRODUCTS.map((p) => (
                <th
                  key={p}
                  className={cn(
                    "px-2 py-3 text-center align-bottom",
                    p === "fd1" && "rounded-t-lg bg-brand/8",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[13px] font-semibold leading-tight",
                      p === "fd1" && "text-brand",
                    )}
                  >
                    {t(`table.products.${p}`)}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-muted-foreground">
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
                      PRODUCTS[i] === "fd1" && "bg-brand/8",
                    )}
                  >
                    <CellMark cell={cell} label={t(`table.legend.${cell}`)} />
                  </td>
                ))}
              </tr>
            ))}
            {/* Ligne de prix */}
            <tr>
              <td className="py-3 pr-3 text-[13px] font-medium">{t("table.price")}</td>
              {PRODUCTS.map((p) => (
                <td
                  key={p}
                  className={cn(
                    "px-2 py-3 text-center",
                    p === "fd1" && "rounded-b-lg bg-brand/8",
                  )}
                >
                  <span
                    className={cn(
                      "num text-[11px] leading-tight",
                      p === "fd1"
                        ? "font-semibold text-brand"
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
