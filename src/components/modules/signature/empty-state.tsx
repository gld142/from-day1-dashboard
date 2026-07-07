"use client";

/**
 * EmptyState — état vide dessiné, signature Day 1.
 * Icône lucide dans un cercle bg-brand/10, titre + description (chaînes i18n
 * passées en props par l'appelant), action optionnelle.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  /** Chaîne déjà traduite (t("…")) côté appelant. */
  title: string;
  /** Chaîne déjà traduite (t("…")) côté appelant. */
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-brand/10">
        <Icon className="size-5 text-brand" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
