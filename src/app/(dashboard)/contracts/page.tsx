"use client";

/**
 * /contracts — ce que les contrats engagent, et ce qui arrive bientôt.
 * Refondue le 23/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le chiffre qui tient la page est **ce qu'il reste à recouper** : tant qu'une
 * avance n'est pas remboursée, aucune royauté n'arrive, et c'est la seule chose
 * qu'un artiste veut savoir en ouvrant cet écran.
 *
 * L'ancien bloc « Comprendre le recoupement » répétait avance, recoupé et reste
 * pour un seul contrat — les mêmes chiffres que le héros, et le même tracé. Il
 * n'en reste que les trois étapes, repliées : on ne les lit qu'une fois.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ARTISTS, CONTRACTS, getArtist } from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { Contract } from "@/lib/demo/types";
import { fmtDate, fmtEur, fmtInt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import {
  AlertRow,
  ContractsTable,
  RecoupmentSteps,
} from "@/components/modules/droits/contract-widgets";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";

const TODAY_ISO = DEMO_TODAY.toISOString().slice(0, 10);

const SEVERITY_ORDER: Record<"danger" | "warning" | "info", number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

export default function ContractsPage() {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { isLabel, artistId, focusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;
  const focusedArtist = isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  const contracts = useMemo<Contract[]>(
    () => (grouped ? CONTRACTS : CONTRACTS.filter((c) => c.artistId === artistId)),
    [grouped, artistId],
  );

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

  const facts = useMemo(() => {
    const withAdvance = contracts.filter((c) => c.advance > 0);
    const advance = withAdvance.reduce((s, c) => s + c.advance, 0);
    /* Reste contrat par contrat : un contrat recoupé à 120 % ne compense pas
       l'avance d'un autre — ce n'est pas un compte commun. */
    const remaining = withAdvance.reduce(
      (s, c) => s + Math.max(0, c.advance - (c.advance * c.recoupedPct) / 100),
      0,
    );
    const active = contracts.filter((c) => c.endDate >= TODAY_ISO);
    const rates = active.map((c) => c.royaltyRate);

    /* La prochaine date qui engage : l'échéance d'une alerte, sinon la fin d'un
       contrat en cours. C'est elle qui fait revenir sur cette page. */
    const dates: Array<{ date: string; label: string }> = [];
    for (const { alert, contract } of alerts) {
      if (alert.dueDate && alert.dueDate >= TODAY_ISO) {
        dates.push({
          date: alert.dueDate,
          label: t(`alerts.kinds.${alert.kind}`),
        });
      }
      void contract;
    }
    for (const c of active) {
      dates.push({ date: c.endDate, label: t("alerts.kinds.expiry") });
    }
    dates.sort((a, b) => a.date.localeCompare(b.date));

    return {
      advance,
      remaining,
      recouped: Math.max(0, advance - remaining),
      advanceCount: withAdvance.length,
      active: active.length,
      expired: contracts.length - active.length,
      rateLow: rates.length ? Math.min(...rates) : null,
      rateHigh: rates.length ? Math.max(...rates) : null,
      next: dates[0] ?? null,
    };
  }, [contracts, alerts, t]);

  /** Le contrat le plus lourd : celui sur lequel la pédagogie porte. */
  const mainContract = useMemo(
    () =>
      contracts.filter((c) => c.advance > 0).sort((a, b) => b.advance - a.advance)[0] ??
      null,
    [contracts],
  );

  const groups = useMemo(() => {
    if (!grouped) return [{ artist: null, contracts }];
    return ARTISTS.map((a) => ({
      artist: a,
      contracts: contracts.filter((c) => c.artistId === a.id),
    })).filter((g) => g.contracts.length > 0);
  }, [grouped, contracts]);

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const recoupedPct =
    facts.advance === 0 ? 0 : (facts.recouped / facts.advance) * 100;

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={
          grouped
            ? t("subtitleLabel")
            : focusedArtist
              ? t("subtitleFocused", { name: focusedArtist.name })
              : t("subtitle")
        }
      >
        {focusedArtist && <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />}
      </PageHeader>

      <div className="space-y-3">
        {/* Ce qu'il reste à rembourser avant le premier euro de royautés. */}
        <Sheet family="money">
          <SheetHeading>{t("hero.title")}</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {facts.advance === 0 ? "—" : eur(facts.remaining)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {facts.advance === 0
              ? t("hero.noAdvance")
              : facts.remaining === 0
                ? t("hero.captionDone")
                : t("hero.caption")}
          </p>

          {facts.advance > 0 && (
            <>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_18%,transparent)]">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, recoupedPct)}%`,
                    background: "var(--success)",
                  }}
                  title={`${t("hero.barRecouped")} · ${eur(facts.recouped)}`}
                />
              </div>
              <p className="sheet-ink mt-1 flex justify-between text-[11px]">
                <span>
                  {t("hero.barRecouped")} {eur(facts.recouped)}
                </span>
                <span>{fmtInt(locale, Math.round(recoupedPct))} %</span>
                <span>{eur(facts.advance)}</span>
              </p>
            </>
          )}

          <AffiliatedPoints
            points={[
              {
                key: "advance",
                value: facts.advance === 0 ? "—" : eur(facts.advance),
                label: t("kpis.advance"),
                note: t("kpis.advanceHint", { count: facts.advanceCount }),
              },
              {
                key: "active",
                value: fmtInt(locale, facts.active),
                label: t("kpis.active"),
                note: t("kpis.activeHint", { count: facts.expired }),
              },
              {
                key: "rates",
                value:
                  facts.rateLow === null
                    ? "—"
                    : facts.rateLow === facts.rateHigh
                      ? `${fmtInt(locale, facts.rateLow)} %`
                      : t("kpis.ratesRange", {
                          low: fmtInt(locale, facts.rateLow),
                          high: fmtInt(locale, facts.rateHigh ?? facts.rateLow),
                        }),
                label: grouped ? t("kpis.ratesLabel") : t("kpis.rates"),
                note: t("kpis.ratesHint"),
              },
              {
                key: "next",
                value: facts.next ? fmtDate(locale, facts.next.date) : "—",
                label: t("kpis.next"),
                note: facts.next ? facts.next.label : t("kpis.nextNone"),
              },
            ]}
          />
        </Sheet>

        {/* Ce qui arrive : une ligne par alerte, la plus grave en tête. */}
        <Sheet family="money">
          <SheetHeading>{t("alerts.heading")}</SheetHeading>
          {alerts.length === 0 ? (
            <p className="sheet-ink mt-1 text-[13px]">{t("alerts.none")}</p>
          ) : (
            <div className="mt-1">
              {alerts.map(({ alert, contract }, i) => (
                <AlertRow
                  key={`${contract.id}-${alert.kind}-${i}`}
                  alert={alert}
                  contract={contract}
                  artist={grouped ? getArtist(contract.artistId) : undefined}
                />
              ))}
            </div>
          )}
        </Sheet>

        {/* Tous les contrats, et la règle de l'avance repliée dessous. */}
        <Sheet family="money">
          <SheetHeading>{t("table.heading")}</SheetHeading>
          {contracts.length === 0 ? (
            <p className="sheet-ink mt-1 text-[13px]">{t("empty")}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(({ artist, contracts: rows }) => (
                <div key={artist?.id ?? "self"} className="min-w-0">
                  {artist && (
                    <div className="mb-1.5">
                      <ArtistBadge
                        artist={artist}
                        size="sm"
                        meta={t("labelView.contractsOf", { count: rows.length })}
                      />
                    </div>
                  )}
                  <ContractsTable contracts={rows} todayIso={TODAY_ISO} bare />
                </div>
              ))}
            </div>
          )}

          {mainContract && (
            <details className="sheet-rule mt-3 pt-2.5 text-[11.5px] leading-relaxed">
              <summary className="sheet-ink cursor-pointer font-medium">
                {t("recoup.heading")}
              </summary>
              <RecoupmentSteps contract={mainContract} />
            </details>
          )}
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "splits",
              family: "money",
              href: "/splits",
              label: t("doors.splits"),
              value: t("doors.splitsValue"),
            },
            {
              key: "revenue",
              family: "money",
              href: "/revenue",
              label: t("doors.revenue"),
              value: t("doors.revenueValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "calculator",
              family: "money",
              href: "/calculator",
              label: t("doors.calculator"),
              value: t("doors.calculatorValue"),
            },
            {
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
            },
          ]}
        />

        <RestRow
          title={grouped ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "finances", href: "/finances", label: t("rest.finances") },
            { key: "urssaf", href: "/urssaf", label: t("rest.urssaf") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
            { key: "team", href: "/team", label: t("rest.team") },
            { key: "import", href: "/import", label: t("rest.import") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
