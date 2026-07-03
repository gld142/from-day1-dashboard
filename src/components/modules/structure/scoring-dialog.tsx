"use client";

/**
 * Scoring d'investissement A&R — modèle 100 % déterministe :
 * fourchette d'avance + 2 scénarios 12 mois dérivés de l'audience,
 * du momentum 30 j et de l'Index Day 1. Aucun aléatoire (hydration-safe).
 */
import { useLocale, useTranslations } from "next-intl";
import { Info, Rocket, ShieldCheck } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { initialsOf } from "@/components/modules/structure/emerging-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmergingArtist } from "@/lib/demo/types";
import { fmtCompact, fmtEur } from "@/lib/format";

/* ── Modèle déterministe ─────────────────────────────────────────────── */

const STREAMS_PER_LISTENER = 5.5; // streams mensuels par auditeur
const EUR_PER_STREAM = 0.0035;

type Scenario = {
  listeners12m: number;
  revenue12m: number;
};

function project(artist: EmergingArtist, factor: number, cap: number): Scenario {
  const growth = Math.min(1 + (artist.momentum30d / 100) * factor, cap);
  const listeners12m = Math.round(artist.monthlyListeners * growth);
  // Revenu de l'année : moyenne entre audience actuelle et audience projetée.
  const avgListeners = (artist.monthlyListeners + listeners12m) / 2;
  const revenue12m = Math.round(
    avgListeners * STREAMS_PER_LISTENER * EUR_PER_STREAM * 12,
  );
  return { listeners12m, revenue12m };
}

export function scoreArtist(artist: EmergingArtist) {
  const conservative = project(artist, 0.3, 2.2);
  const optimistic = project(artist, 1.2, 6);
  const indexBoost = artist.day1Index / 100;
  const round500 = (n: number) => Math.round(n / 500) * 500;
  const advanceLow = round500(conservative.revenue12m * (0.7 + indexBoost * 0.4));
  const advanceHigh = round500(optimistic.revenue12m * (0.9 + indexBoost * 0.5));
  const advanceMid = (advanceLow + advanceHigh) / 2;
  const breakEvenMonths = Math.min(
    36,
    Math.max(6, Math.round(advanceMid / (optimistic.revenue12m / 12))),
  );
  return { conservative, optimistic, advanceLow, advanceHigh, breakEvenMonths };
}

/* ── UI ──────────────────────────────────────────────────────────────── */

export function ScoringDialog({
  artist,
  onClose,
}: {
  artist: EmergingArtist | null;
  onClose: () => void;
}) {
  const t = useTranslations("arwatch");
  const locale = useLocale();

  if (!artist) return null;
  const score = scoreArtist(artist);

  const scenarios = [
    {
      key: "conservative" as const,
      icon: ShieldCheck,
      hint: t("scoring.conservativeHint"),
      data: score.conservative,
      color: "var(--chart-2)",
    },
    {
      key: "optimistic" as const,
      icon: Rocket,
      hint: t("scoring.optimisticHint"),
      data: score.optimistic,
      color: "var(--chart-1)",
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <ArtistAvatar
              artist={{
                hue: artist.hue,
                initials: initialsOf(artist.name),
                name: artist.name,
              }}
              size="sm"
            />
            {t("scoring.title", { name: artist.name })}
          </DialogTitle>
          <DialogDescription>{t("scoring.description")}</DialogDescription>
        </DialogHeader>

        {/* Fourchette d'avance */}
        <div className="brand-glow rounded-xl border bg-gradient-to-b from-card to-surface-2 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            {t("scoring.range")}
          </p>
          <p className="num mt-1 text-2xl font-semibold tracking-tight">
            {fmtEur(locale, score.advanceLow, { compact: true })}
            <span className="mx-1.5 text-muted-foreground">→</span>
            {fmtEur(locale, score.advanceHigh, { compact: true })}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("scoring.rangeHint")}
          </p>
        </div>

        {/* Deux scénarios */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("scoring.scenarios")}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {scenarios.map(({ key, icon: Icon, hint, data, color }) => (
              <div key={key} className="rounded-xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className="size-3.5" style={{ color }} aria-hidden />
                  {t(`scoring.${key}`)}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {hint}
                </p>
                <dl className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-muted-foreground">
                      {t("scoring.listeners12m")}
                    </dt>
                    <dd className="num text-sm font-semibold">
                      {fmtCompact(locale, data.listeners12m)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] text-muted-foreground">
                      {t("scoring.revenue12m")}
                    </dt>
                    <dd className="num text-sm font-semibold">
                      {fmtEur(locale, data.revenue12m, { compact: true })}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        <p className="num text-xs font-medium">
          {t("scoring.breakEven", { months: score.breakEvenMonths })}
        </p>

        {/* Disclaimer */}
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          {t("scoring.disclaimer")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
