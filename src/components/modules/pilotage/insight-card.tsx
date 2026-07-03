"use client";

/**
 * Carte insight "Ce qui a changé cette nuit" :
 * icône teintée + kicker + phrase générée depuis les données.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightTone = "brand" | "success" | "warning" | "destructive" | "muted";

const TONES: Record<InsightTone, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function InsightCard({
  icon: Icon,
  kicker,
  body,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  kicker: string;
  body: string;
  tone?: InsightTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-4 transition-colors hover:bg-surface-2/50",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            TONES[tone],
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {kicker}
        </span>
      </div>
      <p className="text-sm leading-snug">{body}</p>
    </div>
  );
}
