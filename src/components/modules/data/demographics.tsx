"use client";

/**
 * Démographie estimée — barres horizontales par tranche d'âge
 * + barre empilée hommes/femmes/autres. 100 % déterministe (hash artistId).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { demographyFor } from "./derive";

export function Demographics({ ids }: { ids: string[] }) {
  const locale = useLocale();
  const t = useTranslations("audience");
  const d = useMemo(() => demographyFor(ids), [ids]);

  const pct = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(n / 100);

  const maxAge = Math.max(1, ...d.age.map((a) => a.pct));

  const genderRows = [
    { key: "female", label: t("demo.female"), value: d.gender.female, color: "var(--chart-2)" },
    { key: "male", label: t("demo.male"), value: d.gender.male, color: "var(--chart-3)" },
    { key: "nonbinary", label: t("demo.nonbinary"), value: d.gender.nonbinary, color: "var(--chart-4)" },
  ];

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("demo.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("demo.subtitle")}
        </p>
      </header>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {/* Tranches d'âge */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("demo.age")}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {d.age.map((row) => (
              <li key={row.label} className="flex items-center gap-3">
                <span className="num w-12 shrink-0 text-xs text-muted-foreground">
                  {row.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.pct / maxAge) * 100}%`,
                      background: "var(--chart-1)",
                    }}
                  />
                </div>
                <span className="num w-10 shrink-0 text-right text-xs">
                  {pct(row.pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Répartition par genre */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("demo.gender")}
          </h3>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
            {genderRows.map((g) => (
              <div
                key={g.key}
                style={{ width: `${g.value}%`, background: g.color }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2.5">
            {genderRows.map((g) => (
              <li key={g.key} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: g.color }}
                />
                <span className="flex-1">{g.label}</span>
                <span className="num text-xs">{pct(g.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
