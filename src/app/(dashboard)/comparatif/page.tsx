"use client";

/**
 * vs Concurrents — la page pitch qui montre pourquoi From Day 1 est
 * seul au monde : 7 features Tier S, tableau comparatif, fenêtre de
 * marché et pitch 90 secondes. Contenu statique (vue label), sans
 * données sensibles : reste affiché si on y accède par URL.
 */

import { useLocale, useTranslations } from "next-intl";
import {
  DoorOpen,
  Gauge,
  Gem,
  Hourglass,
  Landmark,
  PieChart,
  Quote,
  Receipt,
  SearchCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fmtEur } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { ComparisonTable } from "@/components/modules/pitch/comparison-table";

const TIER_S: Array<{ key: string; icon: LucideIcon }> = [
  { key: "frRights", icon: Landmark },
  { key: "urssaf", icon: Receipt },
  { key: "audit", icon: SearchCheck },
  { key: "copilot", icon: Sparkles },
  { key: "fractional", icon: PieChart },
  { key: "index", icon: Gauge },
  { key: "valuation", icon: Gem },
];

const WINDOW_CARDS: Array<{ key: string; icon: LucideIcon }> = [
  { key: "market", icon: DoorOpen },
  { key: "barrier", icon: Hourglass },
  { key: "risk", icon: Zap },
];

export default function ComparatifPage() {
  const t = useTranslations("comparatif");
  const locale = useLocale();

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ─── Héro : personne ne réunit les 7 ─── */}
      <section className="rise-in brand-glow rounded-2xl border bg-gradient-to-b from-card to-surface-2 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">
          {t("hero.kicker")}
        </p>
        <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {t("hero.title")}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {t("hero.description")}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_S.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="flex items-start gap-2.5 rounded-xl border bg-card p-3.5"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold leading-tight">
                  {t(`hero.features.${key}.title`)}
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t(`hero.features.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── LE tableau comparatif ─── */}
      <div className="mt-4">
        <ComparisonTable />
      </div>

      {/* ─── Fenêtre de marché ─── */}
      <section className="rise-in mt-4">
        <h2 className="mb-3 font-heading text-base font-semibold">
          {t("window.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {WINDOW_CARDS.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-xl border bg-card p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="num mt-3 font-heading text-lg font-semibold tracking-tight">
                {t(`window.cards.${key}.title`)}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {t(`window.cards.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pitch 90 secondes ─── */}
      <section className="rise-in mt-4 rounded-2xl border border-brand/40 bg-gradient-to-b from-card to-surface-2 p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <Quote className="size-4" aria-hidden />
          </span>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">
            {t("pitch.kicker")}
          </p>
        </div>
        <blockquote className="mt-4 max-w-4xl font-heading text-lg italic leading-relaxed">
          {t("pitch.quote", {
            low: fmtEur(locale, 19),
            high: fmtEur(locale, 199),
          })}
        </blockquote>
        <p className="mt-3 text-xs text-muted-foreground">{t("pitch.author")}</p>
      </section>
    </div>
  );
}
