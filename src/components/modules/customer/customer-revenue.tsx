"use client";

/**
 * /revenue en mode client — les revenus de l'artiste ouvert, tels que son
 * distributeur les déclare, mois par mois. Remplace la page de démo (qui
 * raisonne en estimations quotidiennes) sans la toucher.
 *
 * Ce que seul un relevé dit : ce que CHAQUE plateforme paie vraiment pour
 * 1 000 streams, et quels titres / pays rapportent. Rien d'inventé : tendance
 * et comparaison annuelle seulement si l'historique les permet.
 */
import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useStatementScope } from "@/lib/customer-scope";
import { downloadCsv, round2 } from "@/lib/export";
import { countryRows, monthSeries, platformRows, revenueSummary, trackRows, type MonthPoint } from "@/lib/userdata/statement-insights";
import { paymentLag, platformPay, revenueStability, seasonality } from "@/lib/kpi/statement";
import { KpiList } from "./kpi-ui";
import { FRANCE_2025_PER_1000, SNEP_2025 } from "@/lib/kpi/benchmarks";
import { DSP_LABEL, Dot, MonthBars, PlatformLegend, ScopeSelect, SimpleTable, conversionNote, coverageNote, labelLine, missingDetailLine, platformColor, statementLine, useFormats } from "./shared";

/** En dessous, un taux « pour 1 000 streams » ne veut rien dire (quelques lignes). */
const MIN_STREAMS_FOR_RATE = 1_000;

export function CustomerRevenue() {
  const f = useFormats();
  const { scope, data, label, customer } = useStatementScope();
  const isLabel = scope === "label";
  const view = useMemo(() => {
    if (!data) return null;
    return {
      points: monthSeries(data),
      summary: revenueSummary(data),
      platforms: platformRows(data),
      tracks: trackRows(data, 10),
      countries: countryRows(data, 10),
      pay: new Map((platformPay(data) ?? []).map((p) => [p.dsp, p])),
      stability: revenueStability(data),
      lag: paymentLag(data),
      season: seasonality(data),
    };
  }, [data]);

  if (!data || !view) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Revenus" subtitle={isLabel ? "Aucun relevé importé dans cet espace." : "Aucun relevé importé pour cet artiste."} />
        <Link href="/import" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Importer un relevé</Link>
      </div>
    );
  }

  const { points, summary: s, platforms, tracks, countries, pay, stability, lag, season } = view;
  const seasonSorted = season ? Object.entries(season).sort((a, b) => b[1] - a[1]) : [];
  const calMonth = (k: string) => new Intl.DateTimeFormat(f.locale, { month: "long", timeZone: "UTC" }).format(new Date(`2026-${k}-01T00:00:00Z`));
  const hasDetail = data.trackMonthStreams !== undefined;
  const hasBreakdown = platforms.some((p) => p.revenue !== null);
  const missing = points.filter((p) => p.missing);
  const rated = platforms.filter((p) => p.per1000 !== null && p.streams >= MIN_STREAMS_FOR_RATE).sort((a, b) => (b.per1000 ?? 0) - (a.per1000 ?? 0));
  const chartDsps = hasBreakdown ? platforms.filter((p) => (p.revenue ?? 0) > 0).map((p) => p.dsp) : [];

  // Notes calculées une fois (périmètre label seulement : `label` est nul sinon).
  const coverage = label ? coverageNote(points, label, f.month) : null;
  const titlesMissing = label ? missingDetailLine(label, "titles") : null;
  const countriesMissing = label ? missingDetailLine(label, "countries") : null;
  const hasRev = tracks.some((t) => t.revenue !== null);
  const hasCountryRev = countries.some((c) => c.revenue !== null);

  const exportCsv = () =>
    downloadCsv<MonthPoint>(`day1-revenus-${isLabel ? "label" : (customer?.artistName ?? "artiste")}`, points, [
      { header: "Mois", cell: (p) => p.month },
      { header: "Revenus EUR", cell: (p) => (p.missing ? "" : round2(p.revenue)) },
      { header: "Streams", cell: (p) => (p.missing ? "" : p.streams) },
      { header: "EUR pour 1000 streams", cell: (p) => (p.per1000 === null ? "" : round2(p.per1000)) },
    ]);

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title="Revenus"
        subtitle={isLabel ? labelLine(data, f.month) : `${customer?.artistName ?? data.artistName} · ${statementLine(data, f.month, f.locale)}`}
      >
        {customer && <ScopeSelect page="/revenue" scope={scope} customer={customer} />}
        <ExportMenu label="Exporter" csvLabel="Mois par mois (CSV)" printLabel="Imprimer / PDF" onExportCsv={exportCsv} />
      </PageHeader>

      <div className="space-y-3">
        <Sheet family="money">
          <SheetHeading action={`${s.months} mois`}>Revenus sur la période</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.eur(s.total)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {s.yoy
              ? `${f.month(s.yoy.month)} : ${f.pct(s.yoy.change, true)} par rapport à ${f.month(s.yoy.previous)}`
              : "Comparaison sur un an : il faut le même mois de l'année d'avant dans le relevé."}
          </p>
          <AffiliatedPoints
            points={[
              { key: "avg", value: f.eur(s.avgMonthly), label: "Par mois en moyenne" },
              { key: "best", value: s.best ? f.eur(s.best.value) : "—", label: "Meilleur mois", note: s.best ? f.month(s.best.month) : undefined },
              {
                key: "trend",
                value: s.trend3 === null ? "—" : f.pct(s.trend3, true),
                label: "Tendance 3 mois",
                note: s.trend3 === null ? "il faut 6 mois de relevé" : "3 derniers mois contre les 3 d'avant",
              },
              { key: "per1000", value: s.per1000 === null ? "—" : f.eurCents(s.per1000), label: "Revenu pour 1 000 streams" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Chiffres tels que déclarés par {isLabel ? "les distributeurs" : "ton distributeur"}
          {conversionNote(data)}.
        </p>

        <Sheet family="money">
          <SheetHeading action={hasBreakdown ? "par plateforme" : undefined}>Mois par mois</SheetHeading>
          <MonthBars points={points} kind="revenue" />
          {chartDsps.length > 0 && <PlatformLegend dsps={chartDsps} />}
          {coverage && <p className="sheet-ink mt-2 text-[11px]">{coverage}</p>}
          {missing.length > 0 && (
            <p className="sheet-ink mt-2 text-[11px]">
              Absent{missing.length > 1 ? "s" : ""} du relevé : {missing.map((p) => f.month(p.month)).join(", ")}.
            </p>
          )}
        </Sheet>

        <Sheet family="money">
          <SheetHeading action="sur toute la période du relevé">{isLabel ? "Ce que chaque plateforme paie au label" : "Ce que chaque plateforme te paie"}</SheetHeading>
          {!hasBreakdown ? (
            <p className="sheet-ink text-sm">
              {label
                ? (missingDetailLine(label, "platforms") ?? "Aucun relevé ne porte le détail par plateforme.")
                : (<>Ce relevé a été importé avant le détail par plateforme.{" "}<Link href="/import" className="underline">Réimporte-le</Link> pour voir les revenus de chaque plateforme.</>)}
            </p>
          ) : (
            <>
              {rated.length >= 2 && (
                <p className="mb-3 text-sm">
                  {DSP_LABEL[rated[0].dsp]} {isLabel ? "paie au label" : "te paie"} {f.eurCents(rated[0].per1000!)} pour 1 000 streams,{" "}
                  {DSP_LABEL[rated[rated.length - 1].dsp]} {f.eurCents(rated[rated.length - 1].per1000!)}.
                </p>
              )}
              <SimpleTable
                head={["Plateforme", "Revenus", "Part", "Streams", "Pour 1 000 streams", "Évolution du taux", "Paie vs pèse"]}
                rows={platforms.map((p) => {
                  const k = pay.get(p.dsp);
                  return {
                    key: p.dsp,
                    cells: [
                      <span key="n" className="flex items-center gap-2"><Dot color={platformColor(p.dsp)} />{DSP_LABEL[p.dsp] ?? p.dsp}</span>,
                      p.revenue === null ? "—" : f.eur(p.revenue),
                      p.revenueShare === null ? "—" : f.pct(p.revenueShare),
                      f.compact(p.streams),
                      p.per1000 === null || p.streams < MIN_STREAMS_FOR_RATE ? "—" : f.eurCents(p.per1000),
                      k?.trend == null || p.streams < MIN_STREAMS_FOR_RATE ? "—" : f.pct(k.trend, true),
                      k ? `${k.gap >= 0 ? "+" : "−"}${Math.abs(Math.round(k.gap * 1000) / 10).toLocaleString(f.locale)} pt` : "—",
                    ],
                  };
                })}
              />
              <p className="sheet-ink mt-2 text-[11px]">
                Évolution du taux : taux des 3 derniers mois contre les 3 premiers (6 mois d&apos;activité minimum). Paie vs pèse : part des revenus moins part des écoutes ; positif, la plateforme paie plus que ce qu&apos;elle pèse.
              </p>
            </>
          )}
        </Sheet>

        <Sheet family="money">
          <SheetHeading action={isLabel ? "calculé sur les relevés" : "calculé sur ton relevé"}>À surveiller</SheetHeading>
          <KpiList
            rows={[
              {
                key: "annual",
                label: "Revenu annualisé",
                value: stability ? f.eur(stability.annualized) : null,
                formula: "moyenne des 3 derniers mois × 12",
                missing: "Il faut au moins 2 mois de relevé.",
              },
              {
                key: "cv",
                label: "Variabilité d'un mois à l'autre",
                value: stability ? f.pct(stability.cv) : null,
                formula: "écart-type des revenus mensuels ÷ leur moyenne (plus c'est bas, plus c'est régulier)",
                missing: "Il faut au moins 2 mois de relevé.",
              },
              {
                key: "drop",
                label: "Pire baisse d'un mois",
                value: stability?.worstDrop ? `${f.pct(stability.worstDrop.change, true)} (${f.month(stability.worstDrop.month)})` : null,
                formula: "revenus du mois ÷ revenus du mois précédent − 1",
                missing: stability ? "Aucune baisse d'un mois sur l'autre dans ce relevé." : "Il faut au moins 2 mois de relevé.",
              },
              {
                key: "lag",
                label: "Délai de paiement",
                value: lag ? `${lag.median} mois` : null,
                formula: "médiane, pondérée par les montants, entre le mois d'écoute et le mois du relevé",
                missing: hasDetail
                  ? (isLabel ? "Les distributeurs ne donnent pas la date du relevé dans ces fichiers." : "Ton distributeur ne donne pas la date du relevé dans ce fichier.")
                  : (label ? (missingDetailLine(label, "detail") ?? "Aucun relevé ne porte le détail mois par mois.") : "Réimporte ton relevé : le détail est gardé depuis le 29/09."),
              },
              {
                key: "season",
                label: "Saisonnalité",
                value: seasonSorted.length ? `${calMonth(seasonSorted[0][0])} ×${seasonSorted[0][1].toFixed(2).replace(".", ",")} · ${calMonth(seasonSorted[seasonSorted.length - 1][0])} ×${seasonSorted[seasonSorted.length - 1][1].toFixed(2).replace(".", ",")}` : null,
                formula: "meilleur et pire mois de l'année : moyenne de ce mois ÷ moyenne de tous les mois",
                missing: `Il faut 24 mois de relevé (${isLabel ? "il y en a" : "tu en as"} ${s.months}).`,
              },
              {
                key: "market",
                label: "Repère : marché français",
                value: s.per1000 === null ? null : `${f.eurCents(s.per1000)} contre ≈ ${f.eurCents(FRANCE_2025_PER_1000.audio)}`,
                formula: `${isLabel ? "le revenu du label" : "ton revenu"} pour 1 000 streams contre la moyenne audio du marché français en 2025 (≈ ${f.eurCents(FRANCE_2025_PER_1000.premium)} en abonnement, ≈ ${f.eurCents(FRANCE_2025_PER_1000.free)} en gratuit ; ${SNEP_2025.source}). Indicatif : ${isLabel ? "les relevés couvrent aussi d'autres pays, et les distributeurs prennent leur part" : "ton relevé couvre aussi d'autres pays, et ton distributeur ou ton label prend sa part"}.`,
                missing: "Pas de streams dans ce relevé.",
              },
              ...(data.withheldEur ? [{ key: "withheld", label: "Retenues à la source", value: f.eur(data.withheldEur), formula: isLabel ? "retenues déclarées par les distributeurs sur la période" : "retenues déclarées par ton distributeur sur la période (ex. droits d'auteur retenus)" }] : []),
            ]}
          />
        </Sheet>

        <div className="grid gap-3 xl:grid-cols-2">
          <Sheet family="money">
            <SheetHeading>
              {isLabel ? (hasRev ? "Les titres du label qui rapportent le plus" : "Les titres du label les plus écoutés") : (hasRev ? "Tes titres qui rapportent le plus" : "Tes titres les plus écoutés")}
            </SheetHeading>
            {tracks.length === 0 ? (
              <p className="sheet-ink text-sm">Pas de titres dans ce relevé.</p>
            ) : (
              <SimpleTable
                head={[isLabel ? "Titre · Artiste" : "Titre", "Revenus", "Streams", "Pour 1 000"]}
                rows={tracks.map((t) => ({
                  key: t.key,
                  cells: [
                    <span key="t" className="block max-w-[16rem] truncate">{t.key}</span>,
                    t.revenue === null ? "—" : f.eur(t.revenue),
                    f.compact(t.streams),
                    t.per1000 === null || t.streams < MIN_STREAMS_FOR_RATE ? "—" : f.eurCents(t.per1000),
                  ],
                }))}
              />
            )}
            {titlesMissing && <p className="sheet-ink mt-2 text-[11px]">{titlesMissing}</p>}
          </Sheet>
          <Sheet family="money">
            <SheetHeading>
              {isLabel ? (hasCountryRev ? "D'où viennent les revenus du label" : "Où l'on écoute le label") : (hasCountryRev ? "D'où viennent tes revenus" : "Où l'on t'écoute")}
            </SheetHeading>
            {countries.length === 0 ? (
              <p className="sheet-ink text-sm">Ce relevé ne précise pas les pays.</p>
            ) : (
              <SimpleTable
                head={["Pays", "Revenus", "Streams"]}
                rows={countries.map((c) => ({
                  key: c.key,
                  cells: [f.country(c.key), c.revenue === null ? "—" : f.eur(c.revenue), f.compact(c.streams)],
                }))}
              />
            )}
            {countriesMissing && <p className="sheet-ink mt-2 text-[11px]">{countriesMissing}</p>}
          </Sheet>
        </div>
      </div>
    </div>
  );
}
