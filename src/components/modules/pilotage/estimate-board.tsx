"use client";

/**
 * Tuiles jour / semaine / mois / année de l'estimateur « stream rémunérateur »,
 * chacune en fourchette avec sa confiance et sa provenance.
 *
 * `line` choisit la cascade mise en avant (le grand chiffre) : brut master en
 * vue label, part artiste en vue artiste. Les trois lignes de la cascade sont
 * toujours rappelées en pied de tuile, la ligne mise en avant en gras.
 *
 * `focus` met une période en relief (sélecteur de Revenus) : la tuile
 * correspondante est cernée et son chiffre grossit ; une période sans tuile
 * (90 jours) s'affiche en bandeau compact sous la grille.
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { EstimatePeriod, EstimateSummary } from "@/lib/demo/api";
import { fmtCompact, fmtEur } from "@/lib/format";
import { useEntryReveal, useSkin } from "@/lib/skin";
import { cn } from "@/lib/utils";

/** Les quatre tuiles ; le trimestre n'en a pas (grille de 4 colonnes). */
const TILE_PERIODS: readonly EstimatePeriod[] = [
  "day",
  "week",
  "month",
  "year",
];

type Line = "grossMaster" | "artistShare" | "publishing";
const LINES: Line[] = ["grossMaster", "artistShare", "publishing"];
const LINE_KEY: Record<Line, "gross" | "artist" | "publishing"> = {
  grossMaster: "gross",
  artistShare: "artist",
  publishing: "publishing",
};

/**
 * Signature artiste : les tuiles entrent l'une après l'autre (fondu + montée
 * de 8 px, décalage 60 ms) aux navigations client. En skin structure et sous
 * prefers-reduced-motion, aucune animation — les tuiles sont là, point.
 */
const TILES_GROUP: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const TILE: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

/** Au-delà de ce seuil, on passe en notation compacte (« 479,6 k € », « 5,8 M € »). */
const COMPACT_FROM = 100_000;

/**
 * Montant en € : entier jusqu'à 100 k€, compact au-delà, pour que la
 * fourchette annuelle tienne dans une tuile de 4 colonnes. `ref` permet de
 * décider le format sur une autre valeur (la borne haute) afin que le chiffre
 * central et sa fourchette partagent la même notation.
 */
export function fmtMoney(locale: string, n: number, ref = n): string {
  return fmtEur(locale, n, { compact: Math.abs(ref) >= COMPACT_FROM });
}

export function EstimateBoard({
  summaries,
  line = "grossMaster",
  focus,
  title,
  subtitle,
  actions,
  className,
}: {
  summaries: Record<EstimatePeriod, EstimateSummary>;
  /** Cascade mise en avant : brut master (vue label) ou part artiste (vue artiste). */
  line?: "grossMaster" | "artistShare";
  /** Période mise en relief (tuile cernée, ou bandeau si elle n'a pas de tuile). */
  focus?: EstimatePeriod;
  title: string;
  subtitle: string;
  /** Commandes de l'en-tête (sélecteur de période, lien vers le détail). */
  actions?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("revenue.estimate");
  const tc = useTranslations("common.provenance");
  const locale = useLocale();
  const skin = useSkin();
  const reduceMotion = useReducedMotion();
  /* Navigation client seulement : au chargement initial, les tuiles sont
     visibles dès le HTML serveur. */
  const entry = useEntryReveal();
  const staggered = skin === "artist" && !reduceMotion && entry;

  /* Période en relief sans tuile (90 jours) : bandeau compact sous la grille. */
  const banner =
    focus && !TILE_PERIODS.includes(focus) ? summaries[focus] : null;

  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          {/* Mesure bornée (< 80 caractères par ligne) : le sous-titre ne court
              pas sur toute la largeur. */}
          <p className="mt-0.5 max-w-[58ch] text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {actions}
          <span className="text-xs text-muted-foreground">
            {summaries.month.calibrated ? t("calibrated") : t("notCalibrated")}
          </span>
          {/* D'où viennent les cascades : simulées (contrat inventé) ou renseignées
              par l'artiste. Une seule ligne pour le board — même provenance
              sur toutes les périodes. Deux badges si part et droits diffèrent. */}
          <span
            data-testid="cascades-provenance"
            className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
          >
            {summaries.month.sharesProvenance === summaries.month.publishingProvenance ? (
              <>
                {t("cascades")}
                <ProvenanceBadge provenance={summaries.month.sharesProvenance} />
              </>
            ) : (
              <>
                {t("artist")}
                <ProvenanceBadge provenance={summaries.month.sharesProvenance} />
                <span aria-hidden>·</span>
                {t("publishing")}
                <ProvenanceBadge provenance={summaries.month.publishingProvenance} />
              </>
            )}
          </span>
        </div>
      </div>

      {/* Tuiles à plat : un seul niveau de carte (la section). En 4 colonnes,
          des filets verticaux séparent les périodes ; en 2 colonnes, l'espace
          suffit ; empilées sur mobile, des filets horizontaux. */}
      <motion.div
        className="grid max-sm:divide-y sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6 xl:grid-cols-4 xl:gap-0 xl:divide-x"
        variants={TILES_GROUP}
        initial={staggered ? "hidden" : false}
        animate="show"
      >
        {TILE_PERIODS.map((p) => {
          const s = summaries[p];
          const r = s[line];
          const focused = p === focus;
          return (
            <motion.div
              key={p}
              variants={staggered ? TILE : undefined}
              className="max-sm:py-4 max-sm:first:pt-0 max-sm:last:pb-0 xl:px-5 xl:first:pl-0 xl:last:pr-0"
            >
              {/* La tuile cernée déborde dans la gouttière (marges négatives)
                  sans déplacer les voisines : la grille reste alignée. */}
              <div
                data-period={p}
                aria-current={focused || undefined}
                className={cn(
                  "rounded-lg transition-colors",
                  focused &&
                    "-mx-3 -my-2 bg-brand/[0.06] px-3 py-2 ring-1 ring-brand/40",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium text-muted-foreground",
                      focused && "text-foreground",
                    )}
                  >
                    {t(`period.${p}`)}
                  </span>
                  <ProvenanceBadge provenance={s.provenance} />
                </div>
                <p
                  className={cn(
                    "num mt-1 font-semibold tracking-tight",
                    focused ? "text-3xl" : "text-2xl",
                  )}
                >
                  {fmtMoney(locale, r.mid, r.high)}
                </p>
                <p className="num text-xs text-muted-foreground">
                  {t("range", {
                    low: fmtMoney(locale, r.low, r.high),
                    high: fmtMoney(locale, r.high),
                  })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("streams", {
                    streams: fmtCompact(locale, s.streams),
                    payable: fmtCompact(locale, s.payableStreams),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tc(`confidence.${s.confidence}`)}
                </p>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t pt-2 text-xs">
                  {LINES.map((l) => (
                    <div key={l} className="contents">
                      <dt
                        className={cn(
                          "text-muted-foreground",
                          l === line && "font-medium text-foreground",
                        )}
                      >
                        {t(LINE_KEY[l])}
                      </dt>
                      <dd
                        className={cn(
                          "num text-right",
                          l === line ? "font-medium" : "text-muted-foreground",
                        )}
                      >
                        {fmtMoney(locale, s[l].mid)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Bandeau « 90 jours : 1,2 M € (1,0 – 1,4 M €) » quand la période en
          relief n'a pas de tuile. */}
      {banner && (
        <div
          data-period={focus}
          aria-current
          className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-brand/[0.06] px-4 py-3 ring-1 ring-brand/40"
        >
          <span className="text-xs font-medium text-foreground">
            {t(`period.${banner.period}`)}
          </span>
          <span className="num text-3xl font-semibold tracking-tight">
            {fmtMoney(locale, banner[line].mid, banner[line].high)}
          </span>
          <span className="num text-xs text-muted-foreground">
            {t("range", {
              low: fmtMoney(locale, banner[line].low, banner[line].high),
              high: fmtMoney(locale, banner[line].high),
            })}
          </span>
          <ProvenanceBadge provenance={banner.provenance} />
          <span className="ml-auto text-xs text-muted-foreground">
            {t("streams", {
              streams: fmtCompact(locale, banner.streams),
              payable: fmtCompact(locale, banner.payableStreams),
            })}
          </span>
          <dl className="flex w-full flex-wrap gap-x-4 gap-y-1 text-xs">
            {LINES.map((l) => (
              <div key={l} className="flex gap-1.5">
                <dt
                  className={cn(
                    "text-muted-foreground",
                    l === line && "font-medium text-foreground",
                  )}
                >
                  {t(LINE_KEY[l])}
                </dt>
                <dd
                  className={cn(
                    "num",
                    l === line ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {fmtMoney(locale, banner[l].mid)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
