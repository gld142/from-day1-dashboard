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
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useCustomer } from "@/lib/customer-mode";
import { downloadCsv, round2 } from "@/lib/export";
import { countryRows, monthSeries, platformRows, revenueSummary, trackRows, type MonthPoint } from "@/lib/userdata/statement-insights";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { DSP_LABEL, Dot, MonthBars, PlatformLegend, SimpleTable, platformColor, statementLine, useFormats } from "./shared";

/** En dessous, un taux « pour 1 000 streams » ne veut rien dire (quelques lignes). */
const MIN_STREAMS_FOR_RATE = 1_000;

export function CustomerRevenue() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const view = useMemo(() => {
    if (!data) return null;
    return {
      points: monthSeries(data),
      summary: revenueSummary(data),
      platforms: platformRows(data),
      tracks: trackRows(data, 10),
      countries: countryRows(data, 10),
    };
  }, [data]);

  if (!data || !view) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Revenus" subtitle="Aucun relevé importé pour cet artiste." />
        <Link href="/import" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Importer un relevé</Link>
      </div>
    );
  }

  const { points, summary: s, platforms, tracks, countries } = view;
  const hasBreakdown = platforms.some((p) => p.revenue !== null);
  const missing = points.filter((p) => p.missing);
  const rated = platforms.filter((p) => p.per1000 !== null && p.streams >= MIN_STREAMS_FOR_RATE).sort((a, b) => (b.per1000 ?? 0) - (a.per1000 ?? 0));
  const chartDsps = hasBreakdown ? platforms.filter((p) => (p.revenue ?? 0) > 0).map((p) => p.dsp) : [];

  const exportCsv = () =>
    downloadCsv<MonthPoint>(`day1-revenus-${customer?.artistName ?? "artiste"}`, points, [
      { header: "Mois", cell: (p) => p.month },
      { header: "Revenus EUR", cell: (p) => (p.missing ? "" : round2(p.revenue)) },
      { header: "Streams", cell: (p) => (p.missing ? "" : p.streams) },
      { header: "EUR pour 1000 streams", cell: (p) => (p.per1000 === null ? "" : round2(p.per1000)) },
    ]);

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader title="Revenus" subtitle={`${customer?.artistName ?? data.artistName} · ${statementLine(data, f.month, f.locale)}`}>
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
          <ProvenanceBadge provenance="declared" /> Chiffres tels que déclarés par ton distributeur
          {data.sourceCurrency !== "EUR" ? `, convertis en euros (1 ${data.sourceCurrency} = ${data.eurRate} €)` : ""}.
        </p>

        <Sheet family="money">
          <SheetHeading action={hasBreakdown ? "par plateforme" : undefined}>Mois par mois</SheetHeading>
          <MonthBars points={points} kind="revenue" />
          {chartDsps.length > 0 && <PlatformLegend dsps={chartDsps} />}
          {missing.length > 0 && (
            <p className="sheet-ink mt-2 text-[11px]">
              Absent{missing.length > 1 ? "s" : ""} du relevé : {missing.map((p) => f.month(p.month)).join(", ")}.
            </p>
          )}
        </Sheet>

        <Sheet family="money">
          <SheetHeading action="sur toute la période du relevé">Ce que chaque plateforme te paie</SheetHeading>
          {!hasBreakdown ? (
            <p className="sheet-ink text-sm">
              Ce relevé a été importé avant le détail par plateforme.{" "}
              <Link href="/import" className="underline">Réimporte-le</Link> pour voir les revenus de chaque plateforme.
            </p>
          ) : (
            <>
              {rated.length >= 2 && (
                <p className="mb-3 text-sm">
                  {DSP_LABEL[rated[0].dsp]} te paie {f.eurCents(rated[0].per1000!)} pour 1 000 streams,{" "}
                  {DSP_LABEL[rated[rated.length - 1].dsp]} {f.eurCents(rated[rated.length - 1].per1000!)}.
                </p>
              )}
              <SimpleTable
                head={["Plateforme", "Revenus", "Part", "Streams", "Pour 1 000 streams"]}
                rows={platforms.map((p) => ({
                  key: p.dsp,
                  cells: [
                    <span key="n" className="flex items-center gap-2"><Dot color={platformColor(p.dsp)} />{DSP_LABEL[p.dsp] ?? p.dsp}</span>,
                    p.revenue === null ? "—" : f.eur(p.revenue),
                    p.revenueShare === null ? "—" : f.pct(p.revenueShare),
                    f.compact(p.streams),
                    p.per1000 === null || p.streams < MIN_STREAMS_FOR_RATE ? "—" : f.eurCents(p.per1000),
                  ],
                }))}
              />
            </>
          )}
        </Sheet>

        <div className="grid gap-3 xl:grid-cols-2">
          <Sheet family="money">
            <SheetHeading>{tracks.some((t) => t.revenue !== null) ? "Tes titres qui rapportent le plus" : "Tes titres les plus écoutés"}</SheetHeading>
            {tracks.length === 0 ? (
              <p className="sheet-ink text-sm">Pas de titres dans ce relevé.</p>
            ) : (
              <SimpleTable
                head={["Titre", "Revenus", "Streams", "Pour 1 000"]}
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
          </Sheet>
          <Sheet family="money">
            <SheetHeading>{countries.some((c) => c.revenue !== null) ? "D'où viennent tes revenus" : "Où l'on t'écoute"}</SheetHeading>
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
          </Sheet>
        </div>
      </div>
    </div>
  );
}
