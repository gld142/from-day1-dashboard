"use client";

/**
 * /valuation — combien vaut le catalogue, et pourquoi. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Les trois cartes « scénarios » (prudent / nominal / optimiste) affichaient
 * exactement `v.low`, `v.mid` et `v.high` — les trois chiffres déjà donnés par
 * la fourchette du héros et par le point « écart ». Elles disparaissent ; ce
 * qu'elles seules disaient (pourquoi le bas et le haut existent) devient la
 * légende de la barre de fourchette.
 *
 * Le chiffre n'est jamais montré seul : la barre place l'estimation dans sa
 * fourchette, parce qu'une valorisation à l'unité près serait un mensonge.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ARTISTS,
  catalogValuation,
  getArtist,
  revenueForecast,
} from "@/lib/demo/api";
import { artistColor, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import { ExactValuePanel } from "@/components/modules/finances/exact-value-panel";

/** La barre de fourchette : bas — estimation — haut, à l'échelle. */
function RangeBar({
  low,
  mid,
  high,
  format,
}: {
  low: number;
  mid: number;
  high: number;
  format: (n: number) => string;
}) {
  const span = Math.max(1, high - low);
  const pos = ((mid - low) / span) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-2.5 w-full rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_18%,transparent)]">
        <div
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${pos}%`, background: "var(--sheet-line)" }}
          aria-hidden
        />
      </div>
      <p className="sheet-ink mt-1 flex justify-between text-[11px] tabular-nums">
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </p>
    </div>
  );
}

export default function ValuationPage() {
  const t = useTranslations("valuation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

  const artist = getArtist(artistId);
  const v = useMemo(() => catalogValuation(artistId), [artistId]);
  const [multiple, setMultiple] = useState(
    Math.round((v.multipleLow + v.multipleHigh) / 2),
  );

  const simulated = v.nps * multiple;
  const inRange = multiple >= v.multipleLow && multiple <= v.multipleHigh;

  // Projection : valorisation médiane dans 12 mois si la croissance tient.
  const future = useMemo(() => {
    const forecast = revenueForecast(artistId, { horizon: 12 });
    const projected = forecast
      .filter((p) => p.projected !== null)
      .reduce((s, p) => s + (p.projected ?? 0), 0);
    const futureNps = projected * 0.72;
    return Math.round((futureNps * (v.multipleLow + v.multipleHigh)) / 2);
  }, [artistId, v]);

  const rosterRows = useMemo(
    () =>
      aggregated
        ? ARTISTS.map((a) => ({ artist: a, val: catalogValuation(a.id) })).sort(
            (x, y) => y.val.mid - x.val.mid,
          )
        : [],
    [aggregated],
  );
  const portfolio = useMemo(
    () => ({
      total: rosterRows.reduce((s, r) => s + r.val.mid, 0),
      low: rosterRows.reduce((s, r) => s + r.val.low, 0),
      high: rosterRows.reduce((s, r) => s + r.val.high, 0),
      nps: rosterRows.reduce((s, r) => s + r.val.nps, 0),
    }),
    [rosterRows],
  );

  const eur = (n: number) => fmtEur(locale, n, { compact: true });

  const doors = (
    <Doors
      title={tc("blocks.doors")}
      doors={[
        {
          key: "calculator",
          family: "money",
          href: "/calculator",
          label: t("doors.calculator"),
          value: t("doors.calculatorValue"),
        },
        {
          key: "catalog",
          family: "catalog",
          href: "/catalog",
          label: t("doors.catalog"),
          value: t("doors.catalogValue"),
        },
        {
          key: "revenue",
          family: "money",
          href: "/revenue",
          label: t("doors.revenue"),
          value: t("doors.revenueValue"),
        },
        {
          key: "finances",
          family: "money",
          href: "/finances",
          label: t("doors.finances"),
          value: t("doors.financesValue"),
        },
        {
          key: "contracts",
          family: "money",
          href: "/contracts",
          label: t("doors.contracts"),
          value: t("doors.contractsValue"),
        },
        {
          key: "splits",
          family: "money",
          href: "/splits",
          label: t("doors.splits"),
          value: t("doors.splitsValue"),
        },
      ]}
    />
  );

  const rest = (
    <RestRow
      title={aggregated ? tc("blocks.restLabel") : tc("blocks.rest")}
      items={[
        { key: "pulse", href: "/pulse", label: t("rest.pulse") },
        { key: "roster", href: "/roster", label: t("rest.roster") },
        { key: "audit", href: "/audit", label: t("rest.audit") },
        { key: "rights", href: "/rights", label: t("rest.rights") },
        { key: "sync", href: "/sync", label: t("rest.sync") },
        { key: "index", href: "/day1-index", label: t("rest.index") },
      ]}
    />
  );

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {!aggregated && isLabel && <ArtistBadge artist={artist} meta={artist.genre} />}
      </PageHeader>

      <div className="space-y-3">
        {aggregated ? (
          <>
            {/* Ce que pèse le portefeuille, et qui le porte. */}
            <Sheet family="money">
              <SheetHeading
                action={t("hero.portfolioHint", { count: rosterRows.length })}
              >
                {t("byArtist.portfolioTotal")}
              </SheetHeading>
              <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
                {eur(portfolio.total)}
              </p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                {t("hero.range", {
                  low: eur(portfolio.low),
                  high: eur(portfolio.high),
                })}
              </p>
              <RangeBar
                low={portfolio.low}
                mid={portfolio.total}
                high={portfolio.high}
                format={eur}
              />
              <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
                {t("hero.rangeHint")}
              </p>
            </Sheet>

            <Sheet family="money">
              <SheetHeading
                action={`${t("byArtist.nps")} · ${t("byArtist.multiple")} · ${t("byArtist.value")}`}
              >
                {t("byArtist.title")}
              </SheetHeading>
              <div className="mt-1 flex flex-col">
                {rosterRows.map(({ artist: a, val }) => {
                  const barW =
                    portfolio.total === 0 ? 0 : (val.mid / portfolio.total) * 100;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setFocusedArtistId(a.id)}
                      className="border-border/50 group flex items-center gap-3 border-t py-2.5 text-left transition-colors first:border-t-0 hover:bg-[color-mix(in_oklab,var(--sheet-line)_8%,transparent)]"
                    >
                      <ArtistBadge
                        artist={a}
                        size="md"
                        meta={a.genre}
                        className="min-w-0 flex-1 sm:w-48 sm:flex-none"
                      />
                      <div className="hidden min-w-0 flex-1 sm:block">
                        <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_16%,transparent)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barW}%`,
                              background: artistColor(a.hue),
                            }}
                          />
                        </div>
                      </div>
                      {/* NPS et multiple sont le détail du calcul : sous
                          640 px ils poussent la ligne hors de l'écran. */}
                      <span className="sheet-ink hidden w-20 shrink-0 text-right text-xs tabular-nums sm:block">
                        {eur(val.nps)}
                      </span>
                      <span className="sheet-ink hidden w-16 shrink-0 text-right text-xs tabular-nums sm:block">
                        {val.multipleLow}–{val.multipleHigh}×
                      </span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums sm:w-24">
                        {eur(val.mid)}
                      </span>
                      <ArrowRight
                        className="sheet-ink hidden size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </Sheet>
          </>
        ) : (
          <>
            {isLabel && <ExactValuePanel artist={artist} valuation={v} />}

            {/* La valeur, dans sa fourchette — jamais un chiffre nu. */}
            <Sheet family="money">
              <SheetHeading action={t("kpis.npsHint")}>
                {t("kpis.midValue")}
              </SheetHeading>
              <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
                {eur(v.mid)}
              </p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                {t("hero.range", { low: eur(v.low), high: eur(v.high) })}
              </p>
              <RangeBar low={v.low} mid={v.mid} high={v.high} format={eur} />
              <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
                {t("hero.rangeHint")}
              </p>

              <AffiliatedPoints
                points={[
                  {
                    key: "nps",
                    value: eur(v.nps),
                    label: t("kpis.nps"),
                    note: t("kpis.npsHint"),
                  },
                  {
                    key: "multiple",
                    value: `${v.multipleLow}–${v.multipleHigh}×`,
                    label: t("kpis.multiple"),
                    note: t("kpis.multipleHint", {
                      stage: t(`stages.${artist.careerStage}`),
                    }),
                  },
                  {
                    key: "range",
                    value: `±${Math.round(((v.high - v.mid) / v.mid) * 100)} %`,
                    label: t("kpis.range"),
                    note: t("kpis.rangeHint"),
                  },
                  {
                    key: "future",
                    value: eur(future),
                    label: t("kpis.future"),
                    note: t("kpis.futureHint"),
                  },
                ]}
              />
            </Sheet>

            <div className="grid gap-3 lg:grid-cols-2">
              {/* Pourquoi ce chiffre — c'est ce qui le rend défendable. */}
              <Sheet family="money">
                <SheetHeading>{t("method.title")}</SheetHeading>
                <ol className="mt-1 flex flex-col gap-2.5">
                  {[
                    t("method.step1", { nps: fmtEur(locale, v.nps) }),
                    t("method.step2", {
                      stage: t(`stages.${artist.careerStage}`),
                      low: v.multipleLow,
                      high: v.multipleHigh,
                    }),
                    t("method.step3", {
                      rangeLow: eur(v.low),
                      rangeHigh: eur(v.high),
                    }),
                  ].map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13px] leading-snug"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_18%,transparent)] text-[10px] font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="sheet-ink sheet-rule mt-3 pt-2.5 text-[11.5px] leading-relaxed">
                  {t("method.note")}
                </p>
              </Sheet>

              {/* Ce qu'un acheteur paierait selon sa conviction. */}
              <Sheet family="money">
                <SheetHeading action={t("simulator.description")}>
                  {t("simulator.title")}
                </SheetHeading>
                <div className="mt-2 flex flex-col items-center gap-3">
                  <span
                    className={cn(
                      /* Plus petit que le héros : à taille égale, les deux
                         chiffres se confondraient au multiple médian. */
                      "text-3xl font-semibold tracking-[-0.03em] tabular-nums",
                      !inRange && "sheet-ink",
                    )}
                  >
                    {eur(simulated)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full tabular-nums",
                      inRange && "border-[var(--sheet-line)]",
                    )}
                  >
                    {t("simulator.atMultiple", { multiple })}
                  </Badge>
                  <div className="relative mt-2 w-full px-1">
                    {/* Zone de marché de l'artiste */}
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_25%,transparent)]"
                      style={{
                        left: `${((v.multipleLow - 6) / (24 - 6)) * 100}%`,
                        width: `${((v.multipleHigh - v.multipleLow) / (24 - 6)) * 100}%`,
                      }}
                      aria-hidden
                    />
                    <input
                      type="range"
                      min={6}
                      max={24}
                      step={1}
                      value={multiple}
                      onChange={(e) => setMultiple(Number(e.target.value))}
                      className="relative w-full accent-[var(--ink-money)]"
                      aria-label={t("simulator.title")}
                    />
                  </div>
                  <div className="sheet-ink flex w-full justify-between px-1 text-[10px] tabular-nums">
                    <span>6×</span>
                    <span className="font-medium">{t("simulator.yourRange")}</span>
                    <span>24×</span>
                  </div>
                </div>
              </Sheet>
            </div>

            {/* Et demain — une porte vers la projection, pas une deuxième page. */}
            <Link
              href="/calculator"
              className="border-border bg-card hover:border-ring/50 group flex flex-col gap-2 rounded-xl border px-4.5 py-3.5 transition-colors lg:flex-row lg:items-center lg:justify-between lg:gap-6"
            >
              <div>
                <p className="text-[13px] font-semibold">{t("growth.title")}</p>
                <p className="text-muted-foreground mt-0.5 max-w-2xl text-[11.5px] leading-relaxed">
                  {t("growth.description", { future: eur(future) })}
                </p>
              </div>
              <span className="text-foreground/80 shrink-0 text-[12px] font-medium group-hover:underline">
                {t("growth.cta")}
                <ArrowRight className="ml-1 inline size-3" aria-hidden />
              </span>
            </Link>
          </>
        )}

        {doors}
        {rest}

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
