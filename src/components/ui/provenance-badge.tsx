"use client";

import { useTranslations } from "next-intl";
import type { Provenance } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** Teintes discrètes : vert = mesuré, bleu = reconstitué, ambre = estimé, gris = simulé. */
const TONE: Record<Provenance, string> = {
  measured: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  reconstructed: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  estimated: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  simulated: "border-muted-foreground/30 text-muted-foreground",
};

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  const t = useTranslations("common.provenance");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border bg-card px-1.5 text-[10px] font-medium uppercase tracking-wide",
            TONE[provenance],
            className,
          )}
        >
          {t(provenance)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{t(`tip.${provenance}`)}</TooltipContent>
    </Tooltip>
  );
}
