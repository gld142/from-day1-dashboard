"use client";

import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtEur, fmtPct } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/demo/types";
import { EXPENSE_CATEGORIES } from "@/lib/demo/types";
import { CATEGORY_COLOR } from "./category-badge";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/** Donut dépenses par catégorie + légende chiffrée. */
export function CategoryDonut({
  data,
}: {
  data: Array<{ category: ExpenseCategory; amount: number }>;
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
              strokeWidth={0}
              animationDuration={600}
            >
              {ordered.map((d) => (
                <Cell key={d.category} fill={CATEGORY_COLOR[d.category]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">{t("donut.total")}</span>
          <span className="num text-lg font-semibold tracking-tight">
            {fmtEur(locale, total, { compact: true })}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {[...ordered]
          .sort((a, b) => b.amount - a.amount)
          .map((d) => (
            <li key={d.category} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: CATEGORY_COLOR[d.category] }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {t(`categories.${d.category}`)}
              </span>
              <span className="num text-xs text-muted-foreground">
                {fmtPct(locale, (d.amount / total) * 100, 0).replace("+", "")}
              </span>
              <span className="num w-20 text-right font-medium">
                {fmtEur(locale, d.amount, { compact: true })}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
