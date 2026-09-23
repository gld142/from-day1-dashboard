"use client";

import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/demo/types";
import { EXPENSE_CATEGORIES } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR } from "./category-badge";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/**
 * Donut dépenses par catégorie + légende chiffrée.
 *
 * La légende n'est pas décorative : chaque ligne est un bouton qui filtre le
 * registre sur sa catégorie. C'est ce qui permet de supprimer le menu déroulant
 * « catégorie » — on désigne la part qu'on veut voir plutôt que de la chercher
 * dans une liste.
 */
export function CategoryDonut({
  data,
  selected,
  onSelect,
}: {
  data: Array<{ category: ExpenseCategory; amount: number }>;
  /** Catégorie retenue au registre, ou `null` pour toutes. */
  selected?: ExpenseCategory | null;
  onSelect?: (category: ExpenseCategory | null) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("finances");

  const total = data.reduce((s, d) => s + d.amount, 0);
  // Ordre stable des catégories → pas de couleurs adjacentes identiques.
  const ordered = EXPENSE_CATEGORIES.map((c) =>
    data.find((d) => d.category === c),
  ).filter((d): d is { category: ExpenseCategory; amount: number } =>
    Boolean(d && d.amount > 0),
  );

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        {t("donut.empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [
                fmtEur(locale, Number(value)),
                t(`categories.${String(name)}`),
              ]}
            />
            <Pie
              data={ordered}
              dataKey="amount"
              nameKey="category"
              innerRadius="64%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--sheet-paper, var(--card))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {ordered.map((d) => (
                <Cell key={d.category} fill={CATEGORY_COLOR[d.category]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="sheet-ink text-[10px] tracking-wide uppercase">{t("donut.total")}</span>
          <span className="num text-lg font-semibold tracking-tight">
            {fmtEur(locale, total, { compact: true })}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-0.5">
        {[...ordered]
          .sort((a, b) => b.amount - a.amount)
          .map((d) => (
            <li key={d.category}>
              <button
                type="button"
                disabled={!onSelect}
                aria-pressed={selected === d.category}
                onClick={() =>
                  onSelect?.(selected === d.category ? null : d.category)
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
                  onSelect &&
                    "hover:bg-[color-mix(in_oklab,var(--sheet-line,var(--border))_12%,transparent)]",
                  selected === d.category &&
                    "bg-[color-mix(in_oklab,var(--sheet-line,var(--border))_18%,transparent)]",
                  selected && selected !== d.category && "opacity-55",
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLOR[d.category] }}
                />
                <span className="sheet-ink min-w-0 flex-1 truncate">
                  {t(`categories.${d.category}`)}
                </span>
                <span className="num sheet-ink text-xs">
                  {fmtPct(locale, (d.amount / total) * 100, 0).replace("+", "")}
                </span>
                <span className="num w-20 text-right font-medium">
                  {fmtEur(locale, d.amount, { compact: true })}
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
