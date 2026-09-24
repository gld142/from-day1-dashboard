"use client";

/**
 * Revenus — la vue consolidée multi-sources. Le module "qui fait tomber
 * le voile" : chaque euro, d'où qu'il vienne, lisible et comparé.
 */

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ARTISTS,
  ESTIMATE_PERIODS,
  dspEstimates,
  estimateSummaries,
  getArtist,
  hasReal,
  dailyTotals,
  monthlyRevenueTotals,
  monthsBasis,
  pnlByArtist,
  revenueBySource,
  revenueSeries,
  rosterDspEstimates,
  rosterEstimateSummaries,
} from "@/lib/demo/api";
import type { DspEstimate, EstimatePeriod, EstimateSummary } from "@/lib/demo/api";
import type { RevenueSource } from "@/lib/demo/types";
import { REVENUE_SOURCES } from "@/lib/demo/types";
import { downloadCsv, round2 } from "@/lib/export";
import { artistColor, fmtCompact, fmtEur, fmtMonth, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { yearWindow } from "@/lib/year-window";
import { useUrlParam } from "@/lib/url-param";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";
import { DeltaChip } from "@/components/dashboard/kpi";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { RevenueCascade } from "@/components/modules/finances/revenue-cascade";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { RevenueStreamsChart } from "@/components/modules/pilotage/revenue-streams-chart";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { SharesPanel } from "@/components/modules/finances/shares-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_COLOR: Record<RevenueSource, string> = {
  streaming: "var(--chart-1)",
  sacem: "var(--chart-2)",
  neighboring: "var(--chart-3)",
  spre: "var(--chart-5)",
  sync: "var(--chart-4)",
  live: "var(--chart-2)",
  merch: "var(--chart-3)",
};

/** `?period=` : une des cinq périodes de l'estimateur, sinon null. */
function parsePeriod(raw: string | null): EstimatePeriod | null {
  return ESTIMATE_PERIODS.includes(raw as EstimatePeriod) ? (raw as EstimatePeriod) : null;
}

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

export default function RevenuePage() {
  const t = useTranslations("revenue");
  const tc = useTranslations("common");
  const tDsp = useTranslations("streams.dsp.names");
  const locale = useLocale();
  const { persona, artistId, isLabel, focusedArtistId, setFocusedArtistId } =
    useRole();
  const aggregated = isLabel && !focusedArtistId;

  /* Période de l'estimation, portée par l'URL (?period=) : le lien « Voir le
   * détail » de Pulse et un rechargement retombent sur la même vue. */
  const [period, setUrlPeriod] = useUrlParam("period", parsePeriod, "month");
  const setPeriod = useCallback(
    (v: string) => setUrlPeriod(v as EstimatePeriod),
    [setUrlPeriod],
  );

  const data = useMemo(() => {
    const ids = aggregated ? ARTISTS.map((a) => a.id) : [artistId];

    // Série mensuelle empilée par source (24 mois).
    const byMonth = new Map<string, Record<string, number>>();
    for (const id of ids) {
      for (const p of revenueSeries(id, 24)) {
        const row = byMonth.get(p.month) ?? {};
        row[p.source] = (row[p.source] ?? 0) + p.amount;
        byMonth.set(p.month, row);
      }
    }
    const stacked = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sources]) => ({ month, ...sources }));

    // Totaux par source (12 mois).
    const bySource = new Map<RevenueSource, number>();
    for (const id of ids) {
      for (const r of revenueBySource(id, 12)) {
        bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.amount);
      }
    }
    const sources = Array.from(bySource.entries())
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount);
    const total12 = sources.reduce((s, r) => s + r.amount, 0);

    /* Delta d'année : on écarte le mois en cours, partiel. Le comparer à un
       mois complet fabriquerait une chute qui n'existe pas. */
    let prev12 = 0;
    let cur12 = 0;
    for (const id of ids) {
      const complete = monthlyRevenueTotals(id, 25).slice(0, -1);
      prev12 += complete.slice(-24, -12).reduce((s, m) => s + m.amount, 0);
      cur12 += complete.slice(-12).reduce((s, m) => s + m.amount, 0);
    }
    const delta = prev12 === 0 ? 0 : ((cur12 - prev12) / prev12) * 100;
    /* Ce que vaut ce delta dépend des mois qu'il compare : tant qu'ils
       précèdent les relevés, ses deux termes sortent d'un historique
       reconstitué puis converti en euros, et un pourcentage affiché nu se lit
       comme un constat. Le périmètre est relu sur la même fenêtre que le
       calcul ci-dessus, pour qu'il ne puisse pas en diverger. */
    const deltaBasis = monthsBasis(
      ids,
      monthlyRevenueTotals(ids[0], 25)
        .slice(0, -1)
        .map((m) => m.month),
    );

    // Tendance par source : 2e semestre vs 1er semestre (12 mois).
    const trendBySource = new Map<RevenueSource, number>();
    for (const source of REVENUE_SOURCES) {
      let first = 0;
      let second = 0;
      for (const id of ids) {
        const pts = revenueSeries(id, 12).filter((p) => p.source === source);
        const months = Array.from(new Set(pts.map((p) => p.month))).sort();
        const firstHalf = new Set(months.slice(0, Math.floor(months.length / 2)));
        for (const p of pts) {
          if (firstHalf.has(p.month)) first += p.amount;
          else second += p.amount;
        }
      }
      trendBySource.set(source, first === 0 ? 0 : ((second - first) / first) * 100);
    }

    return {
      stacked,
      sources,
      total12,
      delta,
      deltaBasis,
      trendBySource,
      monthlyAvg: total12 / 12,
      /* Trié par revenus, parce que c'est ce que la longueur des barres
         encode. `pnlByArtist` trie par résultat net — légitime pour « le plus
         rentable » du Copilot, trompeur ici : la liste descendrait dans un
         ordre pendant que les barres en dessineraient un autre. */
      pnl: aggregated
        ? [...pnlByArtist(12)].sort((a, b) => b.revenue - a.revenue)
        : [],
      spark: monthlyRevenueTotals(ids[0], 24)
        .slice(-12)
        .map((m) => ({ value: m.amount })),
    };
  }, [aggregated, artistId]);

  /* ── Estimation live (couche réelle) : l'artiste en focus, ou le roster ────
   * Les parts renseignées (panneau « Ta part ») changent les cascades : la clé
   * du store est une dépendance, le memo se recalcule à chaque enregistrement. */
  const sharesKey = useSharesSnapshot();
  const est = useMemo<Record<EstimatePeriod, EstimateSummary> | null>(() => {
    void sharesKey;
    if (aggregated) return rosterEstimateSummaries();
    return hasReal(artistId) ? estimateSummaries(artistId) : null;
  }, [aggregated, artistId, sharesKey]);

  /* Par plateforme sur la période choisie : streams, brut master (mid),
   * provenance la plus faible, taux effectif €/stream — la somme des lignes
   * retombe sur le brut master de la tuile correspondante. */
  const byDsp = useMemo<DspEstimate[]>(() => {
    if (aggregated) return rosterDspEstimates(period);
    return hasReal(artistId) ? dspEstimates(artistId, period) : [];
  }, [aggregated, artistId, period]);

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  /** Une part, sans signe. */
  const pct = (points: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
      points / 100,
    );
  /* Les faits d'année, partagés avec la bande « Ton année » de Pulse. */
  const year = useMemo(
    () => yearWindow(aggregated ? ARTISTS.map((a) => a.id) : [artistId]),
    [aggregated, artistId],
  );

  /* Revenus ET streams sur le même axe de temps.
   *
   * Ce graphique existait sur /overview, la page retirée par la refonte, et
   * n'avait été repris nulle part : le dashboard donnait les deux chiffres,
   * jamais leur courbe commune. C'est pourtant la seule façon de voir si les
   * euros suivent les volumes — ou si le taux se dégrade pendant que les
   * streams montent.
   *
   * Il est cadré sur `year.months`, les douze mois complets du chiffre
   * principal : pas une fenêtre de plus. */
  const composed = useMemo(() => {
    const ids = aggregated ? ARTISTS.map((a) => a.id) : [artistId];
    const garde = new Set(year.months);
    const revenus = new Map<string, number>();
    const streams = new Map<string, number>();
    for (const id of ids) {
      for (const m of monthlyRevenueTotals(id, 25)) {
        if (garde.has(m.month)) revenus.set(m.month, (revenus.get(m.month) ?? 0) + m.amount);
      }
      for (const d of dailyTotals(id, 420)) {
        const m = d.date.slice(0, 7);
        if (garde.has(m)) streams.set(m, (streams.get(m) ?? 0) + d.streams);
      }
    }
    return year.months.map((month) => ({
      month,
      revenue: revenus.get(month) ?? 0,
      streams: streams.get(month) ?? 0,
    }));
  }, [aggregated, artistId, year.months]);

  /* Les 12 mois que résume le chiffre du centre, dans une série qui en montre
     24 : la zone ombrée dit lesquels. */
  const window12 = useMemo(() => {
    const months = data.stacked.map((r) => r.month);
    const complete = months.slice(0, -1);
    return complete.length >= 12
      ? { from: complete[complete.length - 12], to: complete[complete.length - 1] }
      : null;
  }, [data.stacked]);

  /* Le meilleur mois de la série empilée — un total d'année ne raconte rien,
     un mois nommé si. */
  const fmtRate = (rate: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(rate);

  const topShare =
    data.total12 === 0 ? 0 : (data.sources[0]?.amount ?? 0) / data.total12;
  const focused = focusedArtistId ? getArtist(focusedArtistId) : null;

  /* ── Export CSV mensuel par source (24 mois) ───────────────────────── */
  const exportMonthlyCsv = () => {
    const rows = data.stacked.flatMap((entry) =>
      REVENUE_SOURCES.flatMap((source) => {
        const amount = (entry as Record<string, string | number>)[source];
        return typeof amount === "number"
          ? [{ month: entry.month, source, amount }]
          : [];
      }),
    );
    downloadCsv("day1-revenue-24m", rows, [
      { header: t("export.month"), cell: (r) => r.month },
      { header: t("breakdown.source"), cell: (r) => t(`sources.${r.source}`) },
      { header: t("breakdown.amount"), cell: (r) => round2(r.amount) },
    ]);
  };
  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={
          aggregated
            ? t("subtitleLabel")
            : isLabel && focused
              ? t("subtitleFocused", { name: focused.name })
              : t("subtitle")
        }
      >
        {focused && <ArtistBadge artist={focused} meta={focused.genre} />}
        <ExportMenu
          onExportCsv={exportMonthlyCsv}
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
        />
      </PageHeader>

      <div className="space-y-3">
        {/* L'année : le total au centre de sa composition mois par mois. */}
        <Sheet family="money">
          <SheetHeading action={`${t("chart.subtitle")} · ${t("chart.window12")}`}>
            {t("chart.title")}
          </SheetHeading>
          <div className="group relative">
            <CenteredValue
              value={eur(data.total12)}
              caption={
                <>
                  {t("kpis.total12m")}{" "}
                  <b className={data.delta >= 0 ? "text-success" : "text-destructive"}>
                    {fmtPct(locale, data.delta)}
                  </b>{" "}
                  <span className="opacity-75">{t("kpis.vsPrevYear")}</span>
                </>
              }
            />
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.stacked} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.14} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
                    minTickGap={48}
                    tickFormatter={(m: string) => fmtMonth(locale, m)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
                    width={56}
                    tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(m) => fmtMonth(locale, String(m))}
                    formatter={(value, name) => [
                      fmtEur(locale, Number(value)),
                      t(`sources.${name as RevenueSource}`),
                    ]}
                  />
                  {window12 && (
                    <ReferenceArea
                      x1={window12.from}
                      x2={window12.to}
                      fill="var(--sheet-line)"
                      fillOpacity={0.07}
                      ifOverflow="extendDomain"
                    />
                  )}
                  {REVENUE_SOURCES.map((source) => (
                    <Area
                      key={source}
                      type="monotone"
                      dataKey={source}
                      stackId="rev"
                      stroke={SOURCE_COLOR[source]}
                      fill={SOURCE_COLOR[source]}
                      fillOpacity={0.22}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Le « vs 12 mois précédents » compare deux fenêtres que personne
              n'a relevées : sans cette ligne, il se lit comme un constat. */}
          <p className="sheet-ink mt-1.5 text-[11.5px] leading-relaxed">
            {data.deltaBasis.measuredMonths.length > 0
              ? t("chart.basisMixed", {
                  months: data.deltaBasis.measuredMonths
                    .map((m) => fmtMonth(locale, m))
                    .join(", "),
                })
              : t("chart.basisReconstructed")}{" "}
            <ProvenanceBadge
              provenance={data.deltaBasis.provenance}
              className="align-middle"
            />
          </p>
          <AffiliatedPoints
            points={[
              {
                key: "avg",
                value: eur(data.monthlyAvg),
                label: t("kpis.monthlyAvg"),
              },
              {
                key: "top",
                value: data.sources[0] ? t(`sources.${data.sources[0].source}`) : "—",
                label: t("kpis.topSource"),
                note: pct(topShare * 100),
              },
              {
                key: "streams12m",
                value: fmtCompact(locale, year.streams),
                label: t("kpis.streams12m"),
                note: t("kpis.streamingShare", { share: pct(year.streamingShare) }),
              },
              {
                key: "best",
                value: year.best ? fmtMonth(locale, year.best.month) : "—",
                label: t("kpis.bestMonth"),
                note: year.best ? eur(year.best.amount) : undefined,
              },
            ]}
          />
        </Sheet>

        {/* Les euros et les volumes sur le même axe : c'est là qu'on voit si
            le taux se dégrade pendant que les streams montent. Bloc repris de
            /overview, la page retirée par la refonte — il n'existait nulle
            part ailleurs. */}
        <Sheet family="money">
          <SheetHeading action={t("composed.subtitle")}>{t("composed.title")}</SheetHeading>
          <RevenueStreamsChart
            data={composed}
            revenueLabel={t("composed.revenue")}
            streamsLabel={t("composed.streams")}
            height={260}
          />
        </Sheet>

        {/* Ce que les streams rapportent — et où passe chaque euro. */}
        {est && (
          <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
            <Sheet family="money">
              <SheetHeading
                action={
                  <Tabs value={period} onValueChange={setPeriod}>
                    <TabsList className="h-7" aria-label={t("estimate.selectPeriod")}>
                      {ESTIMATE_PERIODS.map((p) => (
                        <TabsTrigger key={p} value={p} className="num px-2 text-[11px]">
                          {t(`estimate.period.${p}`)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                }
              >
                {aggregated ? t("estimate.titleLabel") : t("estimate.title")}
              </SheetHeading>
              <p className="sheet-ink text-xs">
                {t("estimate.streams", {
                  streams: fmtCompact(locale, est[period].streams),
                  payable: fmtCompact(locale, est[period].payableStreams),
                })}
              </p>
              <RevenueCascade
                format={(n) => eur(n)}
                steps={[
                  {
                    key: "gross",
                    label: t("estimate.gross"),
                    amount: est[period].grossMaster.mid,
                    range: {
                      low: est[period].grossMaster.low,
                      high: est[period].grossMaster.high,
                    },
                    emphasis: persona !== "artist",
                    note: <ProvenanceBadge provenance="estimated" className="align-middle" />,
                  },
                  {
                    key: "artist",
                    label: t("estimate.artist"),
                    amount: est[period].artistShare.mid,
                    emphasis: persona === "artist",
                    note: (
                      <ProvenanceBadge
                        provenance={est[period].sharesProvenance}
                        className="align-middle"
                      />
                    ),
                  },
                  {
                    key: "publishing",
                    label: t("estimate.publishing"),
                    amount: est[period].publishing.mid,
                    note: (
                      <ProvenanceBadge
                        provenance={est[period].publishingProvenance}
                        className="align-middle"
                      />
                    ),
                  },
                ]}
              />
              <p className="text-muted-foreground mt-3 text-[11.5px] leading-relaxed">
                {t("estimate.subtitle")}
              </p>
            </Sheet>

            {/* Par plateforme, sur la période choisie. */}
            <Sheet family="streams">
              <SheetHeading>
                {t("estimate.byDspPeriod", { period: t(`estimate.period.${period}`) })}
              </SheetHeading>
              <Table className="mt-1">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("estimate.colPlatform")}</TableHead>
                    <TableHead className="text-right">{t("estimate.colStreams")}</TableHead>
                    <TableHead className="text-right">{t("estimate.colRate")}</TableHead>
                    <TableHead className="text-right">{t("estimate.colGross")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byDsp.map((row) => (
                    <TableRow key={row.dsp}>
                      <TableCell className="font-medium">
                        {tDsp(row.dsp)}
                        <ProvenanceBadge
                          provenance={row.provenance}
                          className="ml-1.5 align-middle"
                        />
                      </TableCell>
                      <TableCell className="num text-right">
                        {fmtCompact(locale, row.streams)}
                      </TableCell>
                      <TableCell className="num text-right opacity-75">
                        {t("estimate.dspRate", { rate: fmtRate(row.rate) })}
                      </TableCell>
                      <TableCell className="num text-right font-medium">
                        {eur(row.gross)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Sheet>
          </div>
        )}

        {/* Ta part, c'est ton contrat — jamais sur le roster agrégé. */}
        {est && !aggregated && <SharesPanel artistId={artistId} gross={est.day.grossMaster.mid} />}

        {/* D'où vient l'argent — les sources relèvent du catalogue et des droits. */}
        <Sheet family="catalog">
          <SheetHeading action={t("breakdown.period12m")}>
            {t("breakdown.title")}
          </SheetHeading>
          <div className="mt-1 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
            <div className="relative mx-auto h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      fmtEur(locale, Number(value)),
                      t(`sources.${name as RevenueSource}`),
                    ]}
                  />
                  <Pie
                    data={data.sources}
                    dataKey="amount"
                    nameKey="source"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="var(--sheet-paper)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {data.sources.map((r) => (
                      <Cell key={r.source} fill={SOURCE_COLOR[r.source]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="num text-lg font-semibold tracking-tight">
                  {eur(data.total12)}
                </span>
                <span className="sheet-ink text-[10px] tracking-wide uppercase">
                  {t("breakdown.period12m")}
                </span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("breakdown.source")}</TableHead>
                  <TableHead className="text-right">{t("breakdown.amount")}</TableHead>
                  <TableHead className="text-right">{t("breakdown.share")}</TableHead>
                  <TableHead className="text-right">{t("breakdown.trend")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sources.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: SOURCE_COLOR[r.source] }}
                      />
                      {t(`sources.${r.source}`)}
                    </TableCell>
                    <TableCell className="num text-right">{eur(r.amount)}</TableCell>
                    <TableCell className="num text-right opacity-75">
                      {pct(data.total12 === 0 ? 0 : (r.amount / data.total12) * 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeltaChip value={data.trendBySource.get(r.source) ?? 0} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Sheet>

        {/* Qui rapporte quoi — vue structure seulement. */}
        {aggregated && data.pnl.length > 0 && (
          <Sheet family="money">
            <SheetHeading action={t("byArtist.subtitle")}>{t("byArtist.title")}</SheetHeading>
            <div className="mt-1 space-y-2">
              {data.pnl.map((p) => {
                const maxRev = Math.max(1, ...data.pnl.map((x) => x.revenue));
                return (
                  <button
                    key={p.artistId}
                    type="button"
                    onClick={() => setFocusedArtistId(p.artistId)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="font-medium">{getArtist(p.artistId).name}</span>
                      <span className="flex items-baseline gap-3 tabular-nums">
                        <span className="sheet-ink">
                          {t("byArtist.net")} {eur(p.net)}
                        </span>
                        <b className="font-semibold">{eur(p.revenue)}</b>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_14%,transparent)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.revenue / maxRev) * 100}%`,
                          background: artistColor(getArtist(p.artistId).hue),
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </Sheet>
        )}

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "finances",
              family: "money",
              href: "/finances",
              label: t("doors.finances"),
              value: t("doors.financesValue"),
            },
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
            {
              key: "contracts",
              family: "money",
              href: "/contracts",
              label: t("doors.contracts"),
              value: t("doors.contractsValue"),
            },
            {
              key: "urssaf",
              family: "money",
              href: "/urssaf",
              label: t("doors.urssaf"),
              value: t("doors.urssafValue"),
            },
            {
              key: "calculator",
              family: "money",
              href: "/calculator",
              label: t("doors.calculator"),
              value: t("doors.calculatorValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
