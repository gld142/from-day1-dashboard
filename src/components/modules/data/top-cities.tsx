"use client";

/**
 * Top villes — le relevé Spotify quand il existe, sinon une dérivation du
 * countryBreakdown (part pays × poids ville, seedée). Le libellé et le badge
 * suivent la source : le bloc ne dit « estimé » que lorsqu'il l'est.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmtCompact } from "@/lib/format";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { topCities, topCitiesProvenance } from "./derive";

export function TopCities({
  ids,
  /** Sans carte ni titre : le bloc vit alors dans une feuille qui les porte. */
  bare = false,
}: {
  ids: string[];
  bare?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("audience");

  const rows = useMemo(() => topCities(ids, 8), [ids]);
  const provenance = useMemo(() => topCitiesProvenance(ids), [ids]);
  const mesure = provenance === "measured";
  const max = Math.max(1, ...rows.map((r) => r.listeners));

  const Frame = bare ? "div" : "section";

  return (
    <Frame className={bare ? undefined : "rounded-xl border bg-card p-5"}>
      {!bare && (
        <header>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {t("demo.cities")}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ProvenanceBadge provenance={provenance} />
            {t(mesure ? "demo.citiesHintMeasured" : "demo.citiesHint")}
          </p>
        </header>
      )}

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
    </Frame>
  );
}
