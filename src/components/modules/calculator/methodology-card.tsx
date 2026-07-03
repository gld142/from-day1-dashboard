"use client";

import { useLocale, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { fmtInt } from "@/lib/format";

/** Card méthodologie — transparence totale sur le modèle de projection. */
export function MethodologyCard({ horizon }: { horizon: number }) {
  const locale = useLocale();
  const t = useTranslations("calculator.methodology");
  const maxSpread = Math.round((0.12 + horizon * 0.018) * 100);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-brand/10 text-brand">
          <Info className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {(["point1", "point2", "point3"] as const).map((key) => (
          <li key={key} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
            {t(key)}
          </li>
        ))}
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
          {t("point4", { maxSpread: fmtInt(locale, maxSpread) })}
        </li>
      </ul>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>
    </div>
  );
}
