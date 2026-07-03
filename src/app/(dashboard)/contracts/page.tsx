"use client";

/**
 * /contracts — contrats, alertes et pédagogie du recoupement.
 * Persona artiste : ses contrats. Persona label : groupé par artiste.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ARTISTS, CONTRACTS, getArtist } from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { Contract } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AlertCard,
  ContractsTable,
  RecoupmentViz,
} from "@/components/modules/droits/contract-widgets";

const TODAY_ISO = DEMO_TODAY.toISOString().slice(0, 10);

const SEVERITY_ORDER: Record<"danger" | "warning" | "info", number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

export default function ContractsPage() {
  const t = useTranslations("contracts");
  const { isLabel, artistId, focusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;

  const contracts = useMemo<Contract[]>(
    () => (grouped ? CONTRACTS : CONTRACTS.filter((c) => c.artistId === artistId)),
    [grouped, artistId],
  );

  const kpis = useMemo(() => {
    const active = contracts.filter((c) => c.endDate >= TODAY_ISO).length;
    const alerts = contracts.reduce((s, c) => s + c.alerts.length, 0);
    const avgRecoup =
      contracts.length === 0
        ? 0
        : contracts.reduce((s, c) => s + c.recoupedPct, 0) / contracts.length;
    return { active, alerts, avgRecoup };
  }, [contracts]);

  const alerts = useMemo(
    () =>
      contracts
        .flatMap((c) => c.alerts.map((alert) => ({ alert, contract: c })))
        .sort(
          (a, b) =>
            SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] ||
            (a.alert.dueDate ?? "9999").localeCompare(b.alert.dueDate ?? "9999"),
        ),
    [contracts],
  );

  /** Contrat pédagogique : la plus grosse avance du périmètre. */
  const mainContract = useMemo(
    () =>
      contracts
        .filter((c) => c.advance > 0)
        .sort((a, b) => b.advance - a.advance)[0] ?? null,
    [contracts],
  );

  const groups = useMemo(() => {
    if (!grouped) return [{ artist: null, contracts }];
    return ARTISTS.map((a) => ({
      artist: a,
      contracts: contracts.filter((c) => c.artistId === a.id),
    })).filter((g) => g.contracts.length > 0);
  }, [grouped, contracts]);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          id="contracts-active"
          label={t("kpis.active")}
          value={kpis.active}
          format="int"
        />
        <KpiCard
          id="contracts-alerts"
          label={t("kpis.alerts")}
          value={kpis.alerts}
          format="int"
        />
        <KpiCard
          id="contracts-recoup"
          label={t("kpis.avgRecoup")}
          value={kpis.avgRecoup}
          format="pct"
        />
      </div>

      {alerts.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            {t("alerts.heading")}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {alerts.map(({ alert, contract }, i) => (
              <AlertCard
                key={`${contract.id}-${alert.kind}-${i}`}
                alert={alert}
                contract={contract}
                artist={grouped ? getArtist(contract.artistId) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {mainContract && (
        <div className="mt-6">
          <RecoupmentViz
            contract={mainContract}
            artist={grouped ? getArtist(mainContract.artistId) : undefined}
          />
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          {t("table.heading")}
        </h2>
        {contracts.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ artist, contracts: rows }) => (
              <div key={artist?.id ?? "self"} className="rounded-xl border bg-card p-5">
                {artist && (
                  <div className="mb-3">
                    <ArtistBadge
                      artist={artist}
                      meta={t("labelView.contractsOf", { count: rows.length })}
                    />
                  </div>
                )}
                <ContractsTable contracts={rows} todayIso={TODAY_ISO} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
