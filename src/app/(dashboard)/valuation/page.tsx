"use client";

/**
 * Valorisation catalogue — la feature qui décide les structures à payer.
 * NPS × multiple, fourchette toujours affichée, méthode transparente.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Gem, Info, Scale3d, TrendingUp } from "lucide-react";
import {
  ARTISTS,
  catalogValuation,
  getArtist,
  revenueForecast,
} from "@/lib/demo/api";
import { artistColor, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";

const EUR_COMPACT = {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
} as const;

export default function ValuationPage() {
  const t = useTranslations("valuation");
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
  const portfolioTotal = rosterRows.reduce((s, r) => s + r.val.mid, 0);

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {!aggregated && isLabel && <ArtistBadge artist={artist} size="md" />}
      </PageHeader>

      {aggregated ? (
        /* ─── Vue portefeuille label ─── */
        <>
          <div className="rise-in brand-glow flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-b from-card to-surface-2 py-10">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("byArtist.portfolioTotal")}
            </span>
            <span className="num text-5xl font-semibold tracking-tight">
              <NumberFlow value={portfolioTotal} format={EUR_COMPACT} locales={locale} />
            </span>
            <span className="num mt-1 text-xs text-muted-foreground">
              {ARTISTS.length} × NPS · 8-18×
            </span>
          </div>

          <section className="rise-in mt-4 rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-heading text-base font-semibold">
              {t("byArtist.title")}
            </h2>
            <div className="flex flex-col">
              {rosterRows.map(({ artist: a, val }) => {
                const barW = portfolioTotal === 0 ? 0 : (val.mid / portfolioTotal) * 100;
                return (
                  <button
                    key={a.id}
                    onClick={() => setFocusedArtistId(a.id)}
                    className="hairline-b group flex items-center gap-3 py-3 text-left transition-colors last:shadow-none hover:bg-surface-2"
                  >
                    <ArtistBadge artist={a} size="md" meta={a.genre} className="w-48 shrink-0" />
                    <div className="hidden min-w-0 flex-1 sm:block">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barW}%`, background: artistColor(a.hue) }}
                        />
                      </div>
                    </div>
                    <span className="num w-20 text-right text-xs text-muted-foreground">
                      {fmtEur(locale, val.nps, { compact: true })}
                    </span>
                    <span className="num w-16 text-right text-xs text-muted-foreground">
                      {val.multipleLow}–{val.multipleHigh}×
                    </span>
                    <span className="num w-24 text-right text-sm font-semibold">
                      {fmtEur(locale, val.mid, { compact: true })}
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <span>{t("byArtist.artist")}</span>
              <span className="flex gap-8">
                <span>{t("byArtist.nps")}</span>
                <span>{t("byArtist.multiple")}</span>
                <span>{t("byArtist.value")}</span>
              </span>
            </div>
          </section>
        </>
      ) : (
        /* ─── Vue artiste ─── */
        <>
          {/* Héro valorisation */}
          <div className="rise-in brand-glow flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-b from-card to-surface-2 py-10">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Gem className="size-3.5 text-brand" aria-hidden />
              {t("kpis.midValue")}
            </span>
            <span className="num text-5xl font-semibold tracking-tight">
              <NumberFlow value={v.mid} format={EUR_COMPACT} locales={locale} />
            </span>
            <span className="num mt-1 text-sm text-muted-foreground">
              {fmtEur(locale, v.low, { compact: true })} —{" "}
              {fmtEur(locale, v.high, { compact: true })}
            </span>
          </div>

          {/* KPIs secondaires */}
          <div className="rise-in mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("kpis.nps")}</p>
              <p className="num mt-1 text-xl font-semibold">
                {fmtEur(locale, v.nps, { compact: true })}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("kpis.multiple")}</p>
              <p className="num mt-1 text-xl font-semibold">
                {v.multipleLow}–{v.multipleHigh}×
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("kpis.range")}</p>
              <p className="num mt-1 text-xl font-semibold">
                ±{Math.round(((v.high - v.mid) / v.mid) * 100)} %
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Méthode */}
            <section className="rise-in rounded-xl border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold">
                <Info className="size-4 text-brand" aria-hidden />
                {t("method.title")}
              </h2>
              <ol className="flex flex-col gap-2.5">
                {[
                  t("method.step1", { nps: fmtEur(locale, v.nps) }),
                  t("method.step2", {
                    stage: t(`stages.${artist.careerStage}`),
                    low: v.multipleLow,
                    high: v.multipleHigh,
                  }),
                  t("method.step3", {
                    rangeLow: fmtEur(locale, v.low, { compact: true }),
                    rangeHigh: fmtEur(locale, v.high, { compact: true }),
                  }),
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                    <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("method.note")}
              </p>
            </section>

            {/* Simulateur de multiple */}
            <section className="rise-in rounded-xl border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-heading text-base font-semibold">
                <Scale3d className="size-4 text-brand" aria-hidden />
                {t("simulator.title")}
              </h2>
              <p className="mb-5 text-xs text-muted-foreground">
                {t("simulator.description")}
              </p>
              <div className="flex flex-col items-center gap-3">
                <span
                  className={cn(
                    "num text-4xl font-semibold tracking-tight transition-colors",
                    inRange ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <NumberFlow value={simulated} format={EUR_COMPACT} locales={locale} />
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "num rounded-full",
                    inRange && "border-brand/50 text-brand",
                  )}
                >
                  {t("simulator.atMultiple", { multiple })}
                </Badge>
                <div className="relative mt-2 w-full px-1">
                  {/* Zone de marché de l'artiste */}
                  <div
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand/20"
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
                    className="relative w-full accent-[var(--brand)]"
                    aria-label={t("simulator.title")}
                  />
                </div>
                <div className="num flex w-full justify-between px-1 text-[10px] text-muted-foreground">
                  <span>6×</span>
                  <span className="text-brand">{t("simulator.yourRange")}</span>
                  <span>24×</span>
                </div>
              </div>
            </section>
          </div>

          {/* Scénarios */}
          <section className="rise-in mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["pessimistic", v.low],
                ["nominal", v.mid],
                ["optimistic", v.high],
              ] as const
            ).map(([key, amount]) => (
              <div
                key={key}
                className={cn(
                  "rounded-xl border bg-card p-4",
                  key === "nominal" && "border-brand/40 bg-gradient-to-b from-card to-surface-2",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {t(`scenarios.${key}`)}
                </p>
                <p className="num mt-1 text-2xl font-semibold">
                  {fmtEur(locale, amount, { compact: true })}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t(`scenarios.${key}Desc`)}
                </p>
              </div>
            ))}
          </section>

          {/* Projection */}
          <section className="rise-in mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div>
                <h2 className="font-heading text-base font-semibold">
                  {t("growth.title")}
                </h2>
                <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
                  {t("growth.description", {
                    future: fmtEur(locale, future, { compact: true }),
                  })}
                </p>
              </div>
            </div>
            <Link
              href="/calculator"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("growth.cta")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
