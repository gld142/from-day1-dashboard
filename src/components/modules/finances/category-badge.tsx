"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/lib/demo/types";

/** Couleur stable par catégorie — réutilisée dans le donut, les badges et les barres. */
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  studio: "var(--chart-1)",
  clip: "var(--chart-2)",
  marketing: "var(--chart-3)",
  distribution: "var(--chart-4)",
  promo: "var(--chart-5)",
  tour: "var(--chart-2)",
  other: "var(--muted-foreground)",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: ExpenseCategory;
  className?: string;
}) {
  const t = useTranslations("finances");
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-normal text-muted-foreground", className)}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: CATEGORY_COLOR[category] }}
      />
      {t(`categories.${category}`)}
    </Badge>
  );
}
