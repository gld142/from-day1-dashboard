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
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { SOURCE_IDS, type SourceConfig } from "./sources";

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
  const { setPersona } = useRole();
  const k = `sources.${source.id}`;
  const accent = (chunks: ReactNode) => (
    <span className="text-brand">{chunks}</span>
  );
  /* Montant de la citation : chiffre tabulaire, en couleur de marque. */
  const figure = (chunks: ReactNode) => (
    <span className="num text-brand">{chunks}</span>
  );
  const values = Array.from({ length: source.values }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-14">
      {/* ─── Fenêtre navigateur factice ─── */}
      <section className="rise-in overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b bg-surface-2/60 px-3 py-2">
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
          </div>
          <div className="num mx-auto min-w-0 truncate rounded-md bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            {t("url", { source: source.id })}
          </div>
          {/* Contrepoids des 3 points : l'URL reste centrée optiquement. */}
          <div className="hidden w-[42px] shrink-0 sm:block" aria-hidden />
        </div>

        <div className="p-6 md:p-10">
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
            <p className="mx-auto mt-3 max-w-[60ch] text-[13px] leading-relaxed text-muted-foreground">
              {t(`${k}.welcomeBody`)}
            </p>
            <span className="mt-4 inline-block rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-brand-foreground">
              {t(`${k}.offer`)}
            </span>
          </div>

          {/* 3 étapes : une grille séparée par des filets, pas trois cartes
              dans la carte. Le numéro reste le repère de marque. */}
          <ol className="mt-9 grid max-md:divide-y md:grid-cols-3 md:divide-x">
            {STEPS.map((n) => (
              <li
                key={n}
                className="max-md:py-4 max-md:first:pt-0 max-md:last:pb-0 md:px-6 md:first:pl-0 md:last:pr-0"
              >
                <div className="flex items-center gap-2.5">
                  <span className="num inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                    {n}
                  </span>
                  <h2 className="text-[13px] font-semibold leading-tight">
                    {t(`${k}.steps.${n}.title`)}
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">
                  {t(`${k}.steps.${n}.desc`)}
                </p>
              </li>
            ))}
          </ol>

          {/* Premier insight (montant réel) : une citation entre deux filets,
              le chiffre porte la couleur de marque. Pas de boîte dans la boîte. */}
          <figure className="mx-auto mt-8 max-w-[60ch] border-y py-5 text-center">
            <blockquote className="text-[15px] font-semibold leading-snug md:text-base">
              {t.rich(`${k}.firstInsight`, {
                accent: figure,
                gap: fmtEur(locale, gapEur),
              })}
            </blockquote>
            <figcaption className="mt-3 text-[11px] font-bold uppercase tracking-widest text-brand">
              {t("firstInsightLabel")}
            </figcaption>
          </figure>

          {/* CTA — le persona est appliqué au clic (navigation client : le
              RoleProvider ne se remonte pas) ET porté par l'URL (lien partagé,
              rechargement : lu au montage par RoleProvider). */}
          <div className="mt-7 flex justify-center">
            <Button asChild size="lg" className="px-5">
              <Link
                href={`${source.landing}?persona=${source.persona}`}
                onClick={() => setPersona(source.persona)}
              >
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
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
            {t(`sources.${id}.name`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
