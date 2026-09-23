"use client";

/**
 * /overview — la photo complète, refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Pulse dit ce qui a bougé cette nuit ; Vue d'ensemble dit **ce que tu es** :
 * l'année écoulée, la composition de l'écoute, ce que vaut le catalogue. Les
 * deux pages ne se recouvrent que sur le titre en tête, volontairement.
 *
 * Gabarit : le chiffre clé de l'année au centre de son graphique (héros
 * « argent »), puis trois feuilles — streams, audience, catalogue — chacune
 * avec son chiffre clé et ses lignes attachées, puis les portes.
 */
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  AttachedLines,
  CenteredValue,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DspDonut } from "@/components/modules/pilotage/dsp-donut";
import { RevenueStreamsChart } from "@/components/modules/pilotage/revenue-streams-chart";
import {
  RosterGrid,
  type RosterCardRow,
} from "@/components/modules/pilotage/roster-grid";
import { TerritoryBars } from "@/components/modules/pilotage/territory-bars";
import { Doors, RestRow, type Door } from "@/components/modules/pilotage/pulse-blocks";
import {
  ARTISTS,
  EMERGING,
  TRACKS,
  catalogValuation,
  countryBreakdown,
  dailyTotals,
  fanSegments,
  getArtist,
  labelTotals,
  marketShares,
  monthlyRevenueTotals,
  pnlByArtist,
  revenueBySource,
  rosterRows,
  streamsByDsp,
  streamsDelta,
  sumStreams,
  topTracks,
  tourDates,
} from "@/lib/demo/api";
import { fmtCompact, fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";

/** Streams mensuels dérivés des totaux quotidiens (clé "YYYY-MM"). */
function monthlyStreamsMap(artistIds: string[], days = 396): Map<string, number> {
  const acc = new Map<string, number>();
  for (const id of artistIds) {
    for (const d of dailyTotals(id, days)) {
      const m = d.date.slice(0, 7);
      acc.set(m, (acc.get(m) ?? 0) + d.streams);
    }
  }
  return acc;
}

/**
 * Revenus mensuels agrégés + streams mensuels, sur les 12 derniers mois
 * **complets**. Le mois en cours est partiel : le laisser dans la série ferait
 * plonger la dernière barre et lire un effondrement qui n'existe pas. Il a sa
 * place sur Pulse (« revenus du mois en cours »), pas dans une photo d'année.
 */
function composedSeries(
  artistIds: string[],
): Array<{ month: string; revenue: number; streams: number }> {
  const revenue = new Map<string, number>();
  for (const id of artistIds) {
    for (const m of monthlyRevenueTotals(id, 24)) {
      revenue.set(m.month, (revenue.get(m.month) ?? 0) + m.amount);
    }
  }
  const streams = monthlyStreamsMap(artistIds);
  return Array.from(revenue.keys())
    .sort()
    .slice(0, -1)
    .slice(-12)
    .map((month) => ({
      month,
      revenue: revenue.get(month) ?? 0,
      streams: streams.get(month) ?? 0,
    }));
}

export default function OverviewPage() {
  const t = useTranslations("overview");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { persona, artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();

  const showArtist = persona === "artist" || focusedArtistId !== null;
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  /** Une part, sans signe — fmtPct signe toujours, ce qui n'a pas de sens ici. */
  const pct = (points: number, digits = 1) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: digits,
    }).format(points / 100);

  /* Comparaison d'année : on ne compare que des mois complets. Le mois en cours
     est partiel et ferait apparaître une chute qui n'existe pas. */
  const yearOverYear = (months: Array<{ amount: number }>) => {
    const complete = months.slice(0, -1);
    const last12 = complete.slice(-12).reduce((s, m) => s + m.amount, 0);
    const prev12 = complete.slice(-24, -12).reduce((s, m) => s + m.amount, 0);
    return prev12 === 0 ? 0 : ((last12 - prev12) / prev12) * 100;
  };

  /* ───────────── Vue artiste ───────────── */

  const artistView = useMemo(() => {
    if (!showArtist) return null;
    const artist = getArtist(artistId);

    const series = composedSeries([artistId]);
    const revenue12m = series.reduce((s, m) => s + m.revenue, 0);
    const revenueDelta = yearOverYear(monthlyRevenueTotals(artistId, 25));
    /* Le meilleur mois de l'année : ce qui s'est passé ce mois-là mérite d'être
       su, alors qu'un total de 12 mois ne raconte rien. */
    const best = [...series].sort((a, b) => b.revenue - a.revenue)[0];

    const streams12m = series.reduce((s, m) => s + m.streams, 0);
    const streams30d = sumStreams(artistId, 30);
    const streamsDelta30 = streamsDelta(artistId, 30);
    const dsp = streamsByDsp(artistId, 30).map((d) => ({
      dsp: d.dsp,
      label: t(`dsp.${d.dsp}`),
      streams: d.streams,
    }));
    const pnl = pnlByArtist(12).find((p) => p.artistId === artistId);

    const territories = countryBreakdown(artistId, 30)
      .slice(0, 6)
      .map((c) => ({
        iso3: c.iso3,
        name: locale === "fr" ? c.nameFr : c.nameEn,
        streams: c.streams,
      }));
    const superfans = fanSegments(artistId).find((f) => f.id === "superfans");

    /* Part du streaming dans les revenus : le reste vient des droits d'auteur,
       du live, du merch et des synchros. */
    const bySource = revenueBySource(artistId, 12);
    const totalBySource = bySource.reduce((s, r) => s + r.amount, 0);
    const streamingShare =
      totalBySource === 0
        ? 0
        : (bySource
            .filter((r) => r.source === "streaming")
            .reduce((s, r) => s + r.amount, 0) /
            totalBySource) *
          100;

    const valuation = catalogValuation(artistId);
    const tracks = topTracks(artistId, 30, 3);
    const trackCount = TRACKS.filter((tr) => tr.artistId === artistId).length;

    return {
      artist,
      series,
      revenue12m,
      revenueDelta,
      best,
      streams12m,
      streams30d,
      streamsDelta30,
      dsp,
      pnl,
      territories,
      superfans,
      streamingShare,
      valuation,
      tracks,
      trackCount,
      shows: tourDates(artistId).length,
    };
  }, [showArtist, artistId, locale, t]);

  /* ───────────── Vue structure ───────────── */

  const labelView = useMemo(() => {
    if (showArtist) return null;
    const ids = ARTISTS.map((a) => a.id);
    const totals = labelTotals();
    const series = composedSeries(ids);
    /* Somme mois à mois du roster, puis même comparaison sur mois complets. */
    const rosterMonthly = new Map<string, number>();
    for (const id of ids) {
      for (const m of monthlyRevenueTotals(id, 25)) {
        rosterMonthly.set(m.month, (rosterMonthly.get(m.month) ?? 0) + m.amount);
      }
    }
    const revenueDelta = yearOverYear(
      [...rosterMonthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, amount]) => ({ amount })),
    );
    const best = [...series].sort((a, b) => b.revenue - a.revenue)[0];

    const rows: RosterCardRow[] = rosterRows().map((r) => ({
      ...r,
      spark: dailyTotals(r.id, 30).map((d) => ({ value: d.streams })),
    }));
    const streams30d = ids.reduce((s, id) => s + sumStreams(id, 30), 0);
    const streams12m = series.reduce((s, m) => s + m.streams, 0);

    const dspAcc = new Map<string, number>();
    for (const id of ids) {
      for (const d of streamsByDsp(id, 30)) {
        dspAcc.set(d.dsp, (dspAcc.get(d.dsp) ?? 0) + d.streams);
      }
    }
    const dsp = [...dspAcc.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([id, streams]) => ({ dsp: id, label: t(`dsp.${id}`), streams }));

    const terrAcc = new Map<string, { iso3: string; name: string; streams: number }>();
    for (const id of ids) {
      for (const c of countryBreakdown(id, 30)) {
        const name = locale === "fr" ? c.nameFr : c.nameEn;
        const cur = terrAcc.get(c.iso3) ?? { iso3: c.iso3, name, streams: 0 };
        cur.streams += c.streams;
        terrAcc.set(c.iso3, cur);
      }
    }
    const territories = [...terrAcc.values()]
      .sort((a, b) => b.streams - a.streams)
      .slice(0, 6);

    const listeners = ARTISTS.reduce((s, a) => s + a.monthlyListeners, 0);
    /* Part du roster dans le Top 200 français, pour la porte « Marché ». */
    const rosterNames = new Set(ARTISTS.map((a) => a.name.toLowerCase()));
    const rosterShare =
      marketShares("artist")
        .filter((r) => rosterNames.has(r.label.toLowerCase()))
        .reduce((s, r) => s + r.share, 0) * 100;
    const valuation = ids.reduce((s, id) => s + catalogValuation(id).mid, 0);

    return {
      totals,
      series,
      revenue12m: series.reduce((s, m) => s + m.revenue, 0),
      revenueDelta,
      best,
      rows,
      streams30d,
      streams12m,
      dsp,
      territories,
      listeners,
      rosterShare,
      valuation,
      trackCount: TRACKS.length,
      shows: ids.reduce((s, id) => s + tourDates(id).length, 0),
    };
  }, [showArtist, locale, t]);

  const v = artistView;
  const l = labelView;
  const month = (m?: string) =>
    m ? fmtDate(locale, `${m}-01`, { month: "long", year: "numeric" }) : "—";

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={showArtist ? t("subtitle") : t("subtitleLabel")}>
        {isLabel && focusedArtistId !== null && v && (
          <>
            <ArtistBadge artist={v.artist} size="sm" />
            <Button variant="outline" size="sm" onClick={() => setFocusedArtistId(null)}>
              <ArrowLeft className="size-3.5" aria-hidden />
              {t("backToRoster")}
            </Button>
          </>
        )}
      </PageHeader>

      {v && (
        <div className="space-y-3">
          {/* L'année : le chiffre au centre de sa courbe. */}
          <Sheet family="money">
            <SheetHeading action={<Link href="/revenue">{tc("blocks.detail")}</Link>}>
              {t("hero.year")}
            </SheetHeading>
            <div className="relative">
              <CenteredValue
                value={eur(v.revenue12m)}
                caption={
                  <>
                    {t("hero.caption")}{" "}
                    <b className={v.revenueDelta >= 0 ? "text-success" : "text-destructive"}>
                      {fmtPct(locale, v.revenueDelta)}
                    </b>{" "}
                    <ProvenanceBadge provenance="estimated" className="align-middle" />
                  </>
                }
              />
              <RevenueStreamsChart
                data={v.series}
                revenueLabel={t("chart.revenue")}
                streamsLabel={t("chart.streams")}
                height={210}
              />
            </div>
            <AffiliatedPoints
              points={[
                {
                  key: "streams",
                  value: fmtCompact(locale, v.streams12m),
                  label: t("affiliated.streams12m"),
                },
                {
                  key: "best",
                  value: month(v.best?.month),
                  label: t("affiliated.bestMonth"),
                  note: v.best ? eur(v.best.revenue) : undefined,
                },
                ...(v.pnl
                  ? [
                      {
                        key: "margin",
                        value: pct(v.pnl.margin),
                        label: t("affiliated.margin"),
                        note: t("affiliated.marginNote"),
                      },
                    ]
                  : []),
                {
                  key: "streamingShare",
                  value: pct(v.streamingShare, 0),
                  label: t("affiliated.streamingShare"),
                  note: t("affiliated.streamingShareNote"),
                },
              ]}
            />
          </Sheet>

          <div className="grid gap-3 lg:grid-cols-3">
            <Sheet family="streams">
              <SheetHeading action={<Link href="/streams">{tc("blocks.detail")}</Link>}>
                {tc("families.streams")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {fmtCompact(locale, v.streams30d)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("kpis.streams30d")}{" "}
                <b className={v.streamsDelta30 >= 0 ? "text-success" : "text-destructive"}>
                  {fmtPct(locale, v.streamsDelta30)}
                </b>
              </p>
              <div className="mt-2">
                <DspDonut data={v.dsp} totalLabel={t("dspCard.total")} stacked />
              </div>
            </Sheet>

            <Sheet family="audience">
              <SheetHeading action={<Link href="/audience">{tc("blocks.detail")}</Link>}>
                {tc("families.audience")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {fmtCompact(locale, v.artist.monthlyListeners)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("kpis.listeners")}{" "}
                <ProvenanceBadge provenance="measured" className="align-middle" />
              </p>
              <p className="sheet-ink mt-3 mb-1 text-[11px] font-semibold tracking-[0.06em] uppercase">
                {t("territories.title")}
              </p>
              <TerritoryBars data={v.territories} />
              <AttachedLines
                lines={[
                  ...(v.superfans
                    ? [
                        {
                          key: "superfans",
                          label: t("kpis.superfans"),
                          value: fmtCompact(locale, v.superfans.count),
                        },
                      ]
                    : []),
                  {
                    key: "index",
                    label: t("doors.index"),
                    value: `${v.artist.day1Index} / 100`,
                  },
                  {
                    key: "stage",
                    label: t("kpis.stage"),
                    value: t(`stages.${v.artist.careerStage}`),
                  },
                ]}
              />
            </Sheet>

            <Sheet family="catalog">
              <SheetHeading action={<Link href="/valuation">{tc("blocks.detail")}</Link>}>
                {tc("families.catalog")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {eur(v.valuation.mid)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("kpis.valuation")}{" "}
                <ProvenanceBadge provenance="simulated" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  {
                    key: "tracks",
                    label: t("kpis.tracks"),
                    value: v.trackCount,
                  },
                  ...v.tracks.map((tr) => ({
                    key: tr.id,
                    label: `« ${tr.title} »`,
                    value: fmtCompact(locale, tr.streams),
                  })),
                ]}
              />
            </Sheet>
          </div>

          <Doors
            title={tc("blocks.doors")}
            doors={
              [
                {
                  key: "revenue",
                  href: "/revenue",
                  label: t("doors.revenue"),
                  value: eur(v.revenue12m),
                },
                {
                  key: "streams",
                  href: "/streams",
                  label: t("doors.streams"),
                  value: fmtCompact(locale, v.streams30d),
                },
                v.superfans && {
                  key: "fans",
                  href: "/fans",
                  label: t("doors.fans"),
                  value: fmtCompact(locale, v.superfans.count),
                },
                {
                  key: "index",
                  href: "/day1-index",
                  label: t("doors.index"),
                  value: `${v.artist.day1Index} / 100`,
                },
                {
                  key: "catalog",
                  href: "/catalog",
                  label: t("doors.catalog"),
                  value: t("doors.catalogValue", { count: v.trackCount }),
                },
                {
                  key: "tour",
                  href: "/tour",
                  label: t("doors.tour"),
                  value: t("doors.tourValue", { count: v.shows }),
                },
              ].filter(Boolean) as Door[]
            }
          />

          <RestRow
            title={tc("blocks.rest")}
            items={[
              { key: "pulse", href: "/pulse", label: t("rest.pulse") },
              { key: "market", href: "/market", label: t("rest.market") },
              { key: "audit", href: "/audit", label: t("rest.audit") },
              { key: "rights", href: "/rights", label: t("rest.rights") },
              { key: "splits", href: "/splits", label: t("rest.splits") },
              { key: "contracts", href: "/contracts", label: t("rest.contracts") },
            ]}
          />

          <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
        </div>
      )}

      {l && (
        <div className="space-y-3">
          <Sheet family="money">
            <SheetHeading action={<Link href="/revenue">{tc("blocks.detail")}</Link>}>
              {t("hero.yearLabel")}
            </SheetHeading>
            <div className="relative">
              <CenteredValue
                value={eur(l.revenue12m)}
                caption={
                  <>
                    {t("hero.captionLabel")}{" "}
                    <b className={l.revenueDelta >= 0 ? "text-success" : "text-destructive"}>
                      {fmtPct(locale, l.revenueDelta)}
                    </b>{" "}
                    <ProvenanceBadge provenance="estimated" className="align-middle" />
                  </>
                }
              />
              <RevenueStreamsChart
                data={l.series}
                revenueLabel={t("chart.revenue")}
                streamsLabel={t("chart.streams")}
                height={210}
              />
            </div>
            <AffiliatedPoints
              points={[
                {
                  key: "net",
                  value: eur(l.totals.net12m),
                  label: t("kpis.net12m"),
                  note: t("kpis.netHint"),
                },
                {
                  key: "streams",
                  value: fmtCompact(locale, l.streams12m),
                  label: t("affiliated.streams12m"),
                },
                {
                  key: "best",
                  value: month(l.best?.month),
                  label: t("affiliated.bestMonth"),
                  note: l.best ? eur(l.best.revenue) : undefined,
                },
                {
                  key: "artists",
                  value: ARTISTS.length,
                  label: t("kpis.artists"),
                },
              ]}
            />
          </Sheet>

          {/* Le roster : l'objet central d'une structure, pleine largeur. */}
          <section>
            <h2 className="font-heading mb-0.5 text-base font-semibold tracking-tight">
              {t("roster.title")}
            </h2>
            <p className="text-muted-foreground mb-2 text-xs">{t("roster.subtitle")}</p>
            <RosterGrid
              rows={l.rows}
              labels={{
                streams30d: t("roster.streams30d"),
                revenue12m: t("roster.revenue12m"),
                margin: t("roster.margin"),
                day1Index: t("roster.day1Index"),
                zoom: (name: string) => t("roster.zoom", { name }),
              }}
              onSelect={setFocusedArtistId}
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            <Sheet family="streams">
              <SheetHeading action={<Link href="/streams">{tc("blocks.detail")}</Link>}>
                {tc("families.streamsRoster")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {fmtCompact(locale, l.streams30d)}
              </p>
              <p className="sheet-ink mt-1 text-xs">{t("kpis.streams30d")}</p>
              <div className="mt-2">
                <DspDonut data={l.dsp} totalLabel={t("dspCard.total")} stacked />
              </div>
            </Sheet>

            <Sheet family="audience">
              <SheetHeading action={<Link href="/audience">{tc("blocks.detail")}</Link>}>
                {tc("families.audienceRoster")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {fmtCompact(locale, l.listeners)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("kpis.listenersRoster")}{" "}
                <ProvenanceBadge provenance="measured" className="align-middle" />
              </p>
              <p className="sheet-ink mt-3 mb-1 text-[11px] font-semibold tracking-[0.06em] uppercase">
                {t("territories.title")}
              </p>
              <TerritoryBars data={l.territories} />
            </Sheet>

            <Sheet family="catalog">
              <SheetHeading action={<Link href="/valuation">{tc("blocks.detail")}</Link>}>
                {tc("families.catalog")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {eur(l.valuation)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("kpis.valuation")}{" "}
                <ProvenanceBadge provenance="simulated" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  { key: "tracks", label: t("kpis.tracks"), value: l.trackCount },
                  { key: "artists", label: t("kpis.artists"), value: ARTISTS.length },
                  {
                    key: "shows",
                    label: t("doors.tour"),
                    value: t("doors.tourValue", { count: l.shows }),
                  },
                ]}
              />
            </Sheet>
          </div>

          <Doors
            title={tc("blocks.doors")}
            doors={[
              {
                key: "roster",
                href: "/roster",
                label: t("doors.roster"),
                value: ARTISTS.length,
              },
              {
                key: "revenue",
                href: "/revenue",
                label: t("doors.revenue"),
                value: eur(l.revenue12m),
              },
              {
                key: "valuation",
                href: "/valuation",
                label: t("doors.valuation"),
                value: eur(l.valuation),
              },
              {
                key: "market",
                href: "/market",
                label: t("doors.market"),
                value: t("doors.marketValue", { share: pct(l.rosterShare, 1) }),
              },
              {
                key: "arwatch",
                href: "/ar-watch",
                label: t("doors.arwatch"),
                value: t("doors.arwatchValue", { count: EMERGING.length }),
              },
              {
                key: "finances",
                href: "/finances",
                label: t("doors.finances"),
                value: eur(l.totals.net12m),
              },
            ]}
          />

          <RestRow
            title={tc("blocks.restLabel")}
            items={[
              { key: "pulse", href: "/pulse", label: t("rest.pulse") },
              { key: "audit", href: "/audit", label: t("rest.audit") },
              { key: "rights", href: "/rights", label: t("rest.rights") },
              { key: "contracts", href: "/contracts", label: t("rest.contracts") },
              { key: "team", href: "/team", label: t("rest.team") },
              { key: "calculator", href: "/calculator", label: t("rest.calculator") },
            ]}
          />

          <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
        </div>
      )}
    </div>
  );
}
