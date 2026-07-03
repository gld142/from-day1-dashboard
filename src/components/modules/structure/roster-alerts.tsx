"use client";

/**
 * Alertes roster : clauses contractuelles warning/danger + artistes dont
 * les streams reculent sur 30 jours. Tout est dérivé des données démo.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, FileWarning, TrendingDown } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip } from "@/components/dashboard/kpi";
import { CONTRACTS, getArtist, type RosterRow } from "@/lib/demo/api";
import type { Locale } from "@/i18n/config";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RosterAlerts({ rows }: { rows: RosterRow[] }) {
  const t = useTranslations("roster");
  const locale = useLocale();

  const contractAlerts = useMemo(
    () =>
      CONTRACTS.flatMap((c) =>
        c.alerts
          .filter((a) => a.severity === "warning" || a.severity === "danger")
          .map((a) => ({ contract: c, alert: a })),
      ),
    [],
  );

  const declining = useMemo(
    () => rows.filter((r) => r.delta30d < 0).sort((a, b) => a.delta30d - b.delta30d),
    [rows],
  );

  const empty = contractAlerts.length === 0 && declining.length === 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{t("alerts.title")}</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {t("alerts.subtitle")}
      </p>

      {empty ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          {t("alerts.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {contractAlerts.map(({ contract, alert }, i) => {
            const artist = getArtist(contract.artistId);
            const danger = alert.severity === "danger";
            const Icon = danger ? AlertTriangle : FileWarning;
            return (
              <li
                key={`${contract.id}-${i}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  danger
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-warning/30 bg-warning/5",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    danger ? "text-destructive" : "text-warning",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ArtistBadge artist={artist} size="sm" />
                    {alert.dueDate && (
                      <span className="num text-[11px] text-muted-foreground">
                        {t("alerts.due", {
                          date: fmtDate(locale, alert.dueDate),
                        })}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed">
                    {alert.message[locale as Locale] ?? alert.message.fr}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("alerts.contractMeta", {
                      type: contract.type,
                      counterparty: contract.counterparty,
                    })}
                  </p>
                </div>
              </li>
            );
          })}

          {declining.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <TrendingDown
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ArtistBadge artist={r} size="sm" />
                  <DeltaChip value={r.delta30d} />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed">
                  {t("alerts.decline")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("alerts.declineMeta")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
