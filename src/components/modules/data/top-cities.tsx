"use client";

/**
 * Top villes — dérivé du countryBreakdown (part pays × poids ville, seedé).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmtCompact } from "@/lib/format";
import { topCities } from "./derive";

export function TopCities({ ids }: { ids: string[] }) {
  const locale = useLocale();
  const t = useTranslations("audience");

  const rows = useMemo(() => topCities(ids, 8), [ids]);
  const max = Math.max(1, ...rows.map((r) => r.listeners));

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("demo.cities")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("demo.citiesHint")}
        </p>
      </header>

      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="num w-4 shrink-0 text-xs text-muted-foreground">
              {i + 1}
            </span>
            <span className="w-24 truncate text-sm font-medium">
              {locale === "fr" ? r.nameFr : r.nameEn}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.listeners / max) * 100}%`,
                  background: "var(--chart-2)",
                }}
              />
            </div>
            <span className="num w-14 shrink-0 text-right text-xs text-muted-foreground">
              {fmtCompact(locale, r.listeners)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
