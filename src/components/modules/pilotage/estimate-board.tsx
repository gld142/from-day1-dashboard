"use client";

/**
 * Tuiles jour / semaine / mois / année de l'estimateur « stream rémunérateur »,
 * chacune en fourchette avec sa confiance et sa provenance.
 *
 * `line` choisit la cascade mise en avant (le grand chiffre) : brut master en
 * vue label, part artiste en vue artiste. Les trois lignes de la cascade sont
 * toujours rappelées en pied de tuile, la ligne mise en avant en gras.
 */
import { useLocale, useTranslations } from "next-intl";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { EstimatePeriod, EstimateSummary } from "@/lib/demo/api";
import { fmtCompact, fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS: EstimatePeriod[] = ["day", "week", "month", "year"];

type Line = "grossMaster" | "artistShare" | "publishing";
const LINES: Line[] = ["grossMaster", "artistShare", "publishing"];
const LINE_KEY: Record<Line, "gross" | "artist" | "publishing"> = {
  grossMaster: "gross",
  artistShare: "artist",
  publishing: "publishing",
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
  title,
  subtitle,
  className,
}: {
  summaries: Record<EstimatePeriod, EstimateSummary>;
  /** Cascade mise en avant : brut master (vue label) ou part artiste (vue artiste). */
  line?: "grossMaster" | "artistShare";
  title: string;
  subtitle: string;
  className?: string;
}) {
  const t = useTranslations("revenue.estimate");
  const tc = useTranslations("common.provenance");
  const locale = useLocale();

  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {summaries.month.calibrated ? t("calibrated") : t("notCalibrated")}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PERIODS.map((p) => {
          const s = summaries[p];
          const r = s[line];
          return (
            <div key={p} className="rounded-lg border bg-surface-2/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`period.${p}`)}
                </span>
                <ProvenanceBadge provenance={s.provenance} />
              </div>
              <p className="num mt-1 text-2xl font-semibold tracking-tight">
                {fmtMoney(locale, r.mid, r.high)}
              </p>
              <p className="num text-xs text-muted-foreground">
                {t("range", {
                  low: fmtMoney(locale, r.low, r.high),
                  high: fmtMoney(locale, r.high),
                })}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("streams", {
                  streams: fmtCompact(locale, s.streams),
                  payable: fmtCompact(locale, s.payableStreams),
                })}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {tc(`confidence.${s.confidence}`)}
              </p>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
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
          );
        })}
      </div>
    </section>
  );
}
