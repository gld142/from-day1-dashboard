"use client";

/**
 * Écran d'accueil co-brandé — portage du proto « /welcome?source=believe ».
 * Fenêtre de navigateur factice (3 points + URL), en-tête PARTENAIRE × FROM DAY 1,
 * promesse, offre, 3 étapes, premier insight (montant réel injecté par la page
 * serveur), CTA vers le dashboard avec le persona du canal. Sous la fenêtre :
 * ce que l'onboarding résout et la sidebar par défaut du canal.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SOURCE_IDS, SOURCES, type SourceConfig } from "./sources";

const STEPS = [1, 2, 3] as const;

export function CobrandScreen({
  source,
  gapEur,
}: {
  source: SourceConfig;
  gapEur: number;
}) {
  const t = useTranslations("welcome");
  const tn = useTranslations("nav.items");
  const locale = useLocale();
  const k = `sources.${source.id}`;
  const accent = (chunks: ReactNode) => (
    <span className="text-brand">{chunks}</span>
  );
  const values = Array.from({ length: source.values }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-14">
      {/* ─── Fenêtre navigateur factice ─── */}
      <section className="rise-in overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="relative flex h-9 items-center border-b bg-surface-2/60 px-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
          </div>
          <div className="num absolute left-1/2 -translate-x-1/2 rounded-md bg-background/70 px-3 py-0.5 text-[11px] text-muted-foreground">
            {t("url", { source: source.id })}
          </div>
        </div>

        <div className="bg-gradient-to-b from-card to-surface-2/40 p-6 md:p-10">
          {/* En-tête co-marque */}
          <div className="flex items-center justify-center gap-4">
            {source.logo ? (
              <>
                <span
                  className="rounded-lg px-3.5 py-1.5 text-[13px] font-extrabold tracking-tight"
                  style={{ background: source.logoBg, color: source.logoFg }}
                >
                  {source.logo}
                </span>
                <span className="text-base font-bold text-muted-foreground" aria-hidden>
                  ×
                </span>
              </>
            ) : null}
            <span className="rounded-lg bg-gradient-to-r from-brand to-chart-2 px-3.5 py-1.5 text-[13px] font-extrabold tracking-tight text-background">
              {t("brand")}
            </span>
          </div>

          {/* Promesse */}
          <div className="mx-auto mt-7 max-w-2xl text-center">
            <h1 className="font-heading text-2xl font-bold leading-tight md:text-[28px]">
              {t.rich(`${k}.welcomeTitle`, { accent })}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              {t(`${k}.welcomeBody`)}
            </p>
            <span className="mt-4 inline-block rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-brand-foreground">
              {t(`${k}.offer`)}
            </span>
          </div>

          {/* 3 étapes */}
          <ol className="mt-9 grid gap-4 md:grid-cols-3">
            {STEPS.map((n) => (
              <li
                key={n}
                className="relative rounded-xl border bg-card/80 p-4 pt-5"
              >
                <span className="num absolute -top-3 left-4 inline-flex size-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                  {n}
                </span>
                <h2 className="text-[13px] font-semibold leading-tight">
                  {t(`${k}.steps.${n}.title`)}
                </h2>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  {t(`${k}.steps.${n}.desc`)}
                </p>
              </li>
            ))}
          </ol>

          {/* Premier insight — montant réel */}
          <div className="brand-glow mt-6 rounded-xl border border-brand/30 bg-brand/5 p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand">
              {t("firstInsightLabel")}
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-snug">
              {t.rich(`${k}.firstInsight`, {
                accent,
                gap: fmtEur(locale, gapEur),
              })}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-7 flex justify-center">
            <Button asChild size="lg" className="px-5">
              <Link href={`${source.landing}?persona=${source.persona}`}>
                {t("cta")}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Sous la fenêtre : valeur & sidebar ─── */}
      <div className="rise-in mt-5 grid gap-4 md:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-brand">
            {t("valuesTitle")}
          </h2>
          <ul className="mt-3 divide-y">
            {values.map((i) => (
              <li
                key={i}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 text-xs"
              >
                <span className="text-muted-foreground">
                  {t(`${k}.values.${i}.promise`)}
                </span>
                <ArrowRight className="size-3.5 text-brand" aria-hidden />
                <span className="font-medium">
                  {t(`${k}.values.${i}.delivery`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-surface-2/40 p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("sidebarTitle")}
          </h2>
          <ul className="mt-2.5 space-y-0.5 text-xs">
            {source.sidebar.map((key) => (
              <li
                key={key}
                className="rounded-md bg-brand/8 px-2.5 py-1.5 font-semibold text-brand"
              >
                {tn(key)}
              </li>
            ))}
            {source.hidden.map((key) => (
              <li
                key={key}
                className="px-2.5 py-1.5 text-muted-foreground/60"
              >
                <span className="line-through">{tn(key)}</span>{" "}
                {t("hiddenSuffix")}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ─── Bascule de canal ─── */}
      <nav
        aria-label={t("switchSource")}
        className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs"
      >
        <span className="text-muted-foreground">{t("switchSource")}</span>
        {SOURCE_IDS.map((id) => (
          <Link
            key={id}
            href={`/welcome?source=${id}`}
            aria-current={id === source.id ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 font-medium transition-colors",
              id === source.id
                ? "border-brand text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(`sources.${SOURCES[id].id}.name`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
