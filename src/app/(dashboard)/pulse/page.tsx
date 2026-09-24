"use client";

/**
 * /pulse — le rituel quotidien, refondu le 22/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Trois niveaux de lecture, aucun repli — c'est un pouls, tout se lit d'un coup :
 *  1. le chiffre du jour, au centre de son graphique, avec ses points affiliés ;
 *  2. trois feuilles teintées — argent, audience, tendances ;
 *  3. la nuit, l'import, l'argent à aller chercher, les portes.
 *
 * Deux héros différents parce que deux métiers différents : l'artiste a un
 * catalogue (sa courbe se lit), le label un portefeuille (sa courbe agrégée est
 * écrasée par l'artiste qui pèse le plus — on montre donc qui bouge).
 */
import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { RankMedal } from "@/components/dashboard/rank-medal";
import { AudienceGlyph } from "@/components/dashboard/audience-glyph";
import { StreamGlyph } from "@/components/dashboard/stream-glyph";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  AttachedLines,
  Sheet,
  SheetHeading,
  type AffiliatedPoint,
} from "@/components/dashboard/sheet";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { HeroChart } from "@/components/modules/pilotage/hero-chart";
import {
  Doors,
  Emph,
  ImportBand,
  MoneyToCollect,
  NightStrip,
  YearBand,
  type Door,
  type MoneyLead,
  type NightItem,
} from "@/components/modules/pilotage/pulse-blocks";
import {
  ARTISTS,
  CONTRACTS,
  EMERGING,
  LABEL,
  SPLITS,
  TEAM,
  TRACKS,
  auditFindings,
  catalogValuation,
  countryBreakdown,
  dailyTotals,
  estimateSummaries,
  expensesFor,
  fanSegments,
  artistSharePct,
  getArtist,
  hasReal,
  labelTotals,
  marketRosterTracks,
  marketShares,
  monthlyRevenueTotals,
  pnlByArtist,
  rightsStatements,
  rosterEstimateSummaries,
  rosterRows,
  rosterTiktokSignal,
  streamsByDsp,
  streamsDelta,
  sumStreams,
  syncBriefs,
  syncBriefsClosingSoon,
  tiktokSignal,
  topTracks,
  tourDates,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { fmtCompact, fmtDate, fmtEur, fmtInt, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { yearWindow } from "@/lib/year-window";
import { getShares } from "@/lib/userdata/shares-store";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";

const DAY_MS = 86_400_000;
const REVENUE_DETAIL_HREF = "/revenue?period=month";

/** Taux global indicatif des cotisations artistes-auteurs, sur les revenus d'auteur seuls. */
const AUTHOR_CONTRIB_RATE = 0.205;

function daysUntil(iso: string): number {
  return Math.max(
    0,
    Math.round((new Date(`${iso}T00:00:00Z`).getTime() - DEMO_TODAY.getTime()) / DAY_MS),
  );
}

/** Somme des dailyTotals de tout le roster, jour par jour. */
function aggregatedDaily(days: number): Array<{ date: string; streams: number }> {
  const acc = new Map<string, number>();
  for (const a of ARTISTS) {
    for (const d of dailyTotals(a.id, days)) {
      acc.set(d.date, (acc.get(d.date) ?? 0) + d.streams);
    }
  }
  return Array.from(acc.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([date, streams]) => ({ date, streams }));
}

/** Delta signé (« +1 234 » / « −56 ») pour les compteurs de vidéos. */
function fmtSigned(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    signDisplay: "always",
  }).format(n);
}

/** Écart total encore ouvert avec les relevés déclarés, toutes sources. */
function openGap(findings: ReturnType<typeof auditFindings>): number {
  return findings
    .filter((f) => f.status !== "resolved")
    .reduce((s, f) => s + Math.max(0, f.expected - f.reported), 0);
}

/** Droits estimés par Day 1 mais pas encore versés par les organismes. */
function pendingRights(statements: ReturnType<typeof rightsStatements>): number {
  return statements
    .filter((s) => s.status !== "received")
    .reduce((s, r) => s + Math.max(0, r.expected - r.received), 0);
}

export default function PulsePage() {
  const t = useTranslations("pulse");
  const locale = useLocale();
  const { persona, artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();

  const showArtist = persona === "artist" || focusedArtistId !== null;
  /* Parts renseignées : les cascades des estimations en dépendent. */
  const sharesKey = useSharesSnapshot();
  /* Les briefs de synchro sont les mêmes pour tout le roster : on les compte
     une fois, et les deux personas lisent le même nombre. */
  const syncOpen = useMemo(() => syncBriefs().length, []);
  const syncSoon = useMemo(() => syncBriefsClosingSoon(), []);

  const dateChip = fmtDate(locale, DEMO_TODAY.toISOString(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  /** Une part (0-1) en pourcentage non signé — fmtPct signe toujours et attend des points. */
  const pct = (ratio: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(ratio);

  /* Le bilan d'année — calculé dans lib/year-window pour que Pulse et Revenus
     ne puissent pas diverger. */
  const year = useMemo(
    () => yearWindow(showArtist ? [artistId] : ARTISTS.map((a) => a.id)),
    [showArtist, artistId],
  );

  const yearBand = (
    <YearBand
      title={showArtist ? t("year.title") : t("year.titleLabel")}
      href="/revenue"
      detail={t("year.detail")}
      facts={[
        { key: "rev", value: eur(year.revenue), label: t("year.revenue") },
        {
          key: "streams",
          value: fmtCompact(locale, year.streams),
          label: t("year.streams"),
        },
        ...(year.best
          ? [
              {
                key: "best",
                value: fmtDate(locale, `${year.best.month}-01`, {
                  month: "long",
                  year: "numeric",
                }),
                label: t("year.best"),
              },
            ]
          : []),
        {
          key: "share",
          value: pct(year.streamingShare / 100),
          label: t("year.streaming"),
        },
      ]}
    />
  );

  /* Les balises d'emphase des phrases de la nuit : le message porte
     <em>/<good>/<alert>, la page fournit le rendu. C'est ce qui met les
     chiffres en encre pleine et les urgences en rouge sans couper la phrase. */
  const tags = {
    em: (c: ReactNode) => <Emph>{c}</Emph>,
    good: (c: ReactNode) => <Emph tone="good">{c}</Emph>,
    alert: (c: ReactNode) => <Emph tone="alert">{c}</Emph>,
  };

  /* ───────────── Vue artiste (persona artiste ou label zoomé) ───────────── */

  const artistView = useMemo(() => {
    void sharesKey;
    if (!showArtist) return null;
    const artist = getArtist(artistId);

    const series = dailyTotals(artistId, 365);
    const today = sumStreams(artistId, 1);
    const deltaToday = streamsDelta(artistId, 1);
    const s7 = sumStreams(artistId, 7);
    const d7 = streamsDelta(artistId, 7);
    const s30 = sumStreams(artistId, 30);
    /* Mesuré, pas écrit en dur : 14 jours contre les 14 précédents. */
    const d14 = streamsDelta(artistId, 14);

    const monthly = monthlyRevenueTotals(artistId, 24);
    const revMonth = monthly[monthly.length - 1]?.amount ?? 0;
    const revPrev = monthly[monthly.length - 2]?.amount ?? 0;
    /* Le mois en cours est incomplet : le comparer à un mois précédent complet
       afficherait une chute qui n'existe pas. On ramène le mois précédent au
       même nombre de jours écoulés. */
    const dayOfMonth = DEMO_TODAY.getUTCDate();
    const daysInMonth = new Date(
      Date.UTC(DEMO_TODAY.getUTCFullYear(), DEMO_TODAY.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const daysInPrev = new Date(
      Date.UTC(DEMO_TODAY.getUTCFullYear(), DEMO_TODAY.getUTCMonth(), 0),
    ).getUTCDate();
    const revPrevSoFar = (revPrev / daysInPrev) * dayOfMonth;
    const revDelta =
      revPrevSoFar === 0 ? 0 : ((revMonth - revPrevSoFar) / revPrevSoFar) * 100;
    /* Projection : le rythme du mois en cours prolongé jusqu'à son dernier jour. */
    const revForecast = dayOfMonth === 0 ? revMonth : (revMonth / dayOfMonth) * daysInMonth;

    const est = hasReal(artistId) ? estimateSummaries(artistId) : null;

    /* La cascade « ce qui te reste » : en contrat d'artiste, les coûts sont
       avancés par le producteur et récupérés sur les redevances — ce n'est pas
       une dépense de l'artiste mais un solde à recouper. En indé, ce sont ses
       vraies dépenses. Les cotisations artistes-auteurs, elles, portent sur les
       revenus d'auteur seuls (cf. AUTHOR_SOURCES dans /urssaf). */
    const contract = CONTRACTS.find((c) => c.artistId === artistId);
    const isSigned = artist.dealType !== "indé";
    const toRecoup =
      contract && isSigned
        ? Math.max(0, (contract.advance * (100 - contract.recoupedPct)) / 100)
        : 0;
    const ownExpenses = isSigned
      ? 0
      : expensesFor(artistId, 1).reduce((s, e) => s + e.amount, 0);
    const share30 = est?.month.artistShare.mid ?? 0;
    /* Le pourcentage ANNONCÉ doit être celui que l'estimateur applique. */
    const sharePct = artistSharePct(artistId);
    const publishing30 = est?.month.publishing.mid ?? 0;
    const contributions = publishing30 * AUTHOR_CONTRIB_RATE;
    const left = Math.max(0, share30 + publishing30 - toRecoup - ownExpenses - contributions);

    /* Ce qui a changé cette nuit. */
    const night = streamsByDsp(artistId, 1);
    const nightTotal = night.reduce((s, d) => s + d.streams, 0);
    const bestDsp = night[0];
    const topTrack = topTracks(artistId, 1, 1)[0];
    const tiktok = tiktokSignal(artistId);
    const nextShow = tourDates(artistId).find((d) => d.status === "upcoming");
    const alerts = CONTRACTS.filter((c) => c.artistId === artistId).flatMap((c) => c.alerts);
    const alert =
      alerts.find((a) => a.severity === "danger") ??
      alerts.find((a) => a.severity === "warning") ??
      alerts[0];

    /* De l'argent à aller chercher, et les portes. */
    const gap = openGap(auditFindings(artistId));
    const rightsPending = pendingRights(rightsStatements(artistId));
    const trackIds = new Set(TRACKS.filter((tr) => tr.artistId === artistId).map((tr) => tr.id));
    const splitsPending = SPLITS.filter(
      (s) => trackIds.has(s.trackId) && s.status !== "signed",
    ).length;
    const marketRow = marketShares("artist").find(
      (r) => r.label.toLowerCase() === artist.name.toLowerCase(),
    );
    const pnl = pnlByArtist(12).find((p) => p.artistId === artistId);
    const urssafDue = daysUntil(
      `${DEMO_TODAY.getUTCFullYear()}-${String(Math.ceil((DEMO_TODAY.getUTCMonth() + 1) / 3) * 3 + 1).padStart(2, "0")}-15`,
    );
    const superfans = fanSegments(artistId).find((f) => f.id === "superfans")?.count ?? 0;

    return {
      artist,
      series,
      today,
      deltaToday,
      s7,
      d7,
      s30,
      d14,
      revMonth,
      revDelta,
      revForecast,
      est,
      sharePct,
      toRecoup,
      ownExpenses,
      isSigned,
      contributions,
      left,
      publishing30,
      night: { bestDsp, nightTotal, topTrack, tiktok, nextShow, alert },
      leads: { gap, rightsPending },
      doors: { splitsPending, marketRow, pnl, urssafDue, alerts },
      rest: {
        superfans,
        tracks: trackIds.size,
        shows: tourDates(artistId).length,
        countries: countryBreakdown(artistId, 30).length,
      },
    };
  }, [showArtist, artistId, sharesKey]);

  /* ───────────── Vue structure (roster agrégé) ───────────── */

  const labelView = useMemo(() => {
    void sharesKey;
    if (showArtist) return null;

    const totals = labelTotals();
    const rows = rosterRows();
    const agg = aggregatedDaily(365);
    const today = agg[agg.length - 1]?.streams ?? 0;
    const yesterday = agg[agg.length - 2]?.streams ?? 0;
    const deltaToday = yesterday === 0 ? 0 : ((today - yesterday) / yesterday) * 100;
    const cur7 = agg.slice(-7).reduce((s, d) => s + d.streams, 0);
    const prev7 = agg.slice(-14, -7).reduce((s, d) => s + d.streams, 0);
    const d7 = prev7 === 0 ? 0 : ((cur7 - prev7) / prev7) * 100;
    const s30 = agg.slice(-30).reduce((s, d) => s + d.streams, 0);

    /* Qui bouge : tout le roster, trié par variation — pas seulement le top 3. */
    const movers = [...rows].sort((a, b) => b.delta30d - a.delta30d);
    const topEarner = rows[0]; // rosterRows est trié par revenus 12 mois
    const est = rosterEstimateSummaries();

    const monthly = ARTISTS.map((a) => monthlyRevenueTotals(a.id, 24));
    const revMonth = monthly.reduce((s, m) => s + (m[m.length - 1]?.amount ?? 0), 0);
    const revPrev = monthly.reduce((s, m) => s + (m[m.length - 2]?.amount ?? 0), 0);
    const dayOfMonth = DEMO_TODAY.getUTCDate();
    const daysInMonth = new Date(
      Date.UTC(DEMO_TODAY.getUTCFullYear(), DEMO_TODAY.getUTCMonth() + 1, 0),
    ).getUTCDate();
    /* Même correction qu'en vue artiste : mois en cours vs mois précédent au
       même nombre de jours écoulés. */
    const daysInPrev = new Date(
      Date.UTC(DEMO_TODAY.getUTCFullYear(), DEMO_TODAY.getUTCMonth(), 0),
    ).getUTCDate();
    const revPrevSoFar = (revPrev / daysInPrev) * dayOfMonth;
    const revDelta =
      revPrevSoFar === 0 ? 0 : ((revMonth - revPrevSoFar) / revPrevSoFar) * 100;
    const revForecast = dayOfMonth === 0 ? revMonth : (revMonth / dayOfMonth) * daysInMonth;
    const monthExpenses = ARTISTS.reduce(
      (s, a) => s + expensesFor(a.id, 1).reduce((x, e) => x + e.amount, 0),
      0,
    );

    const nextShow = ARTISTS.flatMap((a) =>
      tourDates(a.id)
        .filter((d) => d.status === "upcoming")
        .map((d) => ({ ...d, artistName: getArtist(a.id).name })),
    ).sort((a, b) => a.date.localeCompare(b.date))[0];
    const alertCount = CONTRACTS.flatMap((c) => c.alerts).filter(
      (a) => a.severity !== "info",
    ).length;
    const tiktok = rosterTiktokSignal();

    const gap = ARTISTS.reduce((s, a) => s + openGap(auditFindings(a.id)), 0);
    const rightsPending = ARTISTS.reduce(
      (s, a) => s + pendingRights(rightsStatements(a.id)),
      0,
    );
    const splitsPending = SPLITS.filter((s) => s.status !== "signed").length;
    const groupRows = marketShares("group");
    const rosterNames = new Set(ARTISTS.map((a) => a.name.toLowerCase()));
    const rosterMarket = marketShares("artist").filter((r) =>
      rosterNames.has(r.label.toLowerCase()),
    );
    const rosterShare = rosterMarket.reduce((s, r) => s + r.share, 0);
    /* Le libellé dit « titres » : il faut compter les titres. `length`
       comptait les ARTISTES du roster présents — 2 au lieu de 4, et en
       contradiction avec /market qui lit pourtant la même capture Kworb.
       Le décompte vient désormais de la même fonction que /market. */
    const rosterTracks = marketRosterTracks();
    const valuation = ARTISTS.reduce((s, a) => s + catalogValuation(a.id).mid, 0);
    /* Un artiste est « renseigné » quand l'utilisateur a saisi ou importé ses
       pourcentages — pas quand le contrat de démo existe. */
    const missingContracts = ARTISTS.filter((a) => getShares(a.id) === null).length;

    return {
      totals,
      rows,
      agg,
      today,
      deltaToday,
      cur7,
      d7,
      s30,
      movers,
      topEarner,
      est,
      revMonth,
      revDelta,
      revForecast,
      monthExpenses,
      valuation,
      night: { nextShow, alertCount, tiktok, topMover: movers[0] },
      leads: { gap, rightsPending },
      doors: { splitsPending, rosterShare, rosterMarket, rosterTracks, groupRows, alertCount },
      missingContracts,
    };
  }, [showArtist, sharesKey]);

  /* ───────────────────────────── Rendu ───────────────────────────── */

  const v = artistView;
  const l = labelView;

  const askPlaceholder = showArtist ? t("ask.placeholder") : t("ask.placeholderLabel");

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

      {/* En-tête : la salutation, l'heure du relevé, et la question. */}
      <div className="mb-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {t("greeting", { name: v ? v.artist.name : LABEL.name })}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="bg-success mr-1.5 inline-block size-1.5 rounded-full align-[1px] shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_22%,transparent)]" />
            {dateChip} · {t("hero.reading")} ·{" "}
            <span className="font-mono text-[10.5px]">{t("hero.nextReading")}</span>
          </p>
        </div>
        <Link
          href="/copilot"
          className="border-input bg-card text-muted-foreground hover:border-ring flex max-w-md flex-1 items-center justify-between rounded-lg border px-3.5 py-2.5 text-[12.5px] transition-colors"
        >
          {askPlaceholder}
          {/* Symbole de raccourci clavier : ne se traduit pas. */}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <kbd className="text-brand text-[11px] font-semibold">⌘K</kbd>
        </Link>
      </div>

      {v && (
        <div className="space-y-3">
          {/* 1 — le chiffre du jour, au centre de son graphique. */}
          <Sheet family="streams">
            <HeroChart
              series={v.series}
              seriesLabel={t("chart.streams")}
              glyph={<StreamGlyph size="lg" className="opacity-80" />}
              heading={<SheetHeading>{t("families.streams")}</SheetHeading>}
              value={fmtCompact(locale, v.today)}
              caption={
                <>
                  {t("hero.todayArtist")}{" "}
                  <b className={v.deltaToday >= 0 ? "text-success" : "text-destructive"}>
                    {fmtPct(locale, v.deltaToday)}
                  </b>{" "}
                  <ProvenanceBadge provenance="measured" className="align-middle" />
                </>
              }
            />
            <AffiliatedPoints
              points={[
                {
                  key: "d7",
                  value: (
                    <>
                      {fmtCompact(locale, v.s7)}{" "}
                      <span
                        className={`text-xs ${v.d7 >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {fmtPct(locale, v.d7)}
                      </span>
                    </>
                  ),
                  label: t("affiliated.d7"),
                },
                {
                  key: "d30",
                  value: fmtCompact(locale, v.s30),
                  label: t("affiliated.d30"),
                  note: t("affiliated.d30Note"),
                },
                ...(v.night.topTrack
                  ? [
                      {
                        key: "track",
                        value: `« ${v.night.topTrack.title} »`,
                        label: t("affiliated.topTrack"),
                        note: t("affiliated.topTrackNote", {
                          streams: fmtCompact(locale, v.night.topTrack.streams),
                        }),
                      } satisfies AffiliatedPoint,
                    ]
                  : []),
                ...(v.night.bestDsp
                  ? [
                      {
                        key: "dsp",
                        value: `${t(`dsp.${v.night.bestDsp.dsp}`)} · ${fmtInt(
                          locale,
                          Math.round(
                            (v.night.bestDsp.streams / Math.max(1, v.night.nightTotal)) * 100,
                          ),
                        )} %`,
                        label: t("affiliated.bestDsp"),
                        note: t("affiliated.bestDspNote"),
                      } satisfies AffiliatedPoint,
                    ]
                  : []),
              ]}
            />
          </Sheet>

          {/* 2 — argent, audience, tendances. */}
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
            <Sheet family="money">
              <SheetHeading
                action={<Link href={REVENUE_DETAIL_HREF}>{t("money.detail")}</Link>}
              >
                {t("families.money")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {eur(v.est?.day.artistShare.mid ?? 0)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("money.yesterday")} ·{" "}
                {t("money.range", {
                  low: eur(v.est?.day.artistShare.low ?? 0),
                  high: eur(v.est?.day.artistShare.high ?? 0),
                })}{" "}
                <ProvenanceBadge provenance="estimated" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  {
                    key: "month",
                    label: t("money.monthCurrent"),
                    value: (
                      <>
                        {eur(v.revMonth)}{" "}
                        <span
                          className={`text-[11px] ${v.revDelta >= 0 ? "text-success" : "text-destructive"}`}
                        >
                          {fmtPct(locale, v.revDelta)}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "forecast",
                    label: (
                      <>
                        {t("money.monthForecast")}{" "}
                        <ProvenanceBadge provenance="estimated" className="align-middle" />
                      </>
                    ),
                    value: `≈ ${eur(v.revForecast)}`,
                  },
                  ...(v.isSigned && v.toRecoup > 0
                    ? [
                        {
                          key: "recoup",
                          label: (
                            <>
                              {t("money.recoup")}{" "}
                              <ProvenanceBadge provenance="simulated" className="align-middle" />
                            </>
                          ),
                          value: `−${eur(v.toRecoup)}`,
                        },
                      ]
                    : v.ownExpenses > 0
                      ? [
                          {
                            key: "expenses",
                            label: t("money.expenses"),
                            value: `−${eur(v.ownExpenses)}`,
                          },
                        ]
                      : []),
                  {
                    key: "contrib",
                    label: (
                      <>
                        {t("money.contributions")}{" "}
                        <span className="text-muted-foreground hidden text-[11px] sm:inline">
                          {t("money.contributionsNote")}
                        </span>
                      </>
                    ),
                    value: `−${eur(v.contributions)}`,
                  },
                  {
                    key: "left",
                    label: <b className="text-foreground">{t("money.leftArtist")}</b>,
                    value: <span className="text-base">{eur(v.left)}</span>,
                  },
                ]}
              />
            </Sheet>

            <Sheet family="audience">
              <SheetHeading>{t("families.audience")}</SheetHeading>
              <p className="flex items-center gap-2.5 text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                <AudienceGlyph size="md" className="opacity-75" />
                <span>{fmtCompact(locale, v.artist.monthlyListeners)}</span>
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("audience.listeners")}{" "}
                <ProvenanceBadge provenance="measured" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  {
                    key: "index",
                    label: t("audience.index"),
                    value: `${v.artist.day1Index} / 100`,
                  },
                  ...(v.night.tiktok
                    ? [
                        {
                          key: "tiktok",
                          label: (
                            <>
                              {t("audience.tiktokVideos")}{" "}
                              <ProvenanceBadge provenance="simulated" className="align-middle" />
                            </>
                          ),
                          value: `${fmtCompact(locale, v.night.tiktok.videos)} · ${fmtSigned(locale, v.night.tiktok.deltaYesterday)}`,
                        },
                      ]
                    : []),
                  {
                    key: "city",
                    label: t("audience.topCountry"),
                    value:
                      (locale === "fr"
                        ? countryBreakdown(v.artist.id, 30)[0]?.nameFr
                        : countryBreakdown(v.artist.id, 30)[0]?.nameEn) ?? "—",
                  },
                ]}
              />
            </Sheet>

            {/* Les deux dernières lignes valaient « +31 % » et « 6 entrées
                playlists » écrits en dur — donc identiques pour Dadju, Nono et
                Kiko. Elles portent maintenant des grandeurs propres à l'artiste,
                et l'en-tête la provenance du signal au lieu d'un « simulé » fixe. */}
            <Sheet family="trends">
              <SheetHeading
                action={<ProvenanceBadge provenance={v.night.tiktok?.provenance ?? "simulated"} />}
              >
                {t("families.trends")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {v.night.tiktok?.trendingRankFr
                  ? t("trends.rank", { rank: v.night.tiktok.trendingRankFr })
                  : "—"}
              </p>
              <p className="sheet-ink mt-1 text-xs">{t("trends.tiktokFr")}</p>
              <AttachedLines
                lines={[
                  {
                    key: "top",
                    label: t("trends.topTrack"),
                    value: v.night.topTrack ? `« ${v.night.topTrack.title} »` : "—",
                  },
                  {
                    key: "gained",
                    label: t("trends.gained14"),
                    value: `${v.d14 >= 0 ? "+" : ""}${pct(v.d14 / 100)}`,
                  },
                  {
                    key: "videos",
                    label: t("trends.tiktokVideos"),
                    value: v.night.tiktok
                      ? t("trends.tiktokVideosValue", {
                          count: fmtCompact(locale, v.night.tiktok.videos),
                        })
                      : "—",
                  },
                ]}
              />
            </Sheet>
          </div>

          {/* 3 — la nuit et la journée qui vient. */}
          <NightStrip
            items={
              [
                {
                  key: "week",
                  kicker: t("night.week.kicker"),
                  body: (
                    <>
                      {v.d7 >= 0
                        ? t.rich("night.week.up", { ...tags, delta: pct(v.d7 / 100) })
                        : t.rich("night.week.down", {
                            ...tags,
                            delta: pct(Math.abs(v.d7) / 100),
                          })}{" "}
                      {v.night.bestDsp
                        ? t.rich("night.week.cause", {
                            ...tags,
                            dsp: t(`dsp.${v.night.bestDsp.dsp}`),
                          })
                        : null}
                    </>
                  ),
                },
                v.night.tiktok && {
                  key: "push",
                  kicker: t("night.push.kicker"),
                  body: (
                    <>
                      {t.rich("night.push.body", {
                        ...tags,
                        videos: fmtCompact(locale, v.night.tiktok.videos),
                        delta: fmtSigned(locale, v.night.tiktok.deltaYesterday),
                      })}{" "}
                      {v.night.tiktok.topSound
                        ? t.rich("night.push.sound", {
                            ...tags,
                            sound: v.night.tiktok.topSound,
                          })
                        : null}
                    </>
                  ),
                  footer: (
                    <span className="text-muted-foreground text-[11px]">
                      {t("night.push.note")}{" "}
                      <ProvenanceBadge provenance="simulated" className="align-middle" />
                    </span>
                  ),
                },
                v.night.nextShow && {
                  key: "show",
                  kicker: t("night.show.kicker"),
                  body: (
                    <>
                      {t.rich("night.show.body", {
                        ...tags,
                        venue: v.night.nextShow.venue,
                        city: v.night.nextShow.city,
                        days: daysUntil(v.night.nextShow.date),
                      })}{" "}
                      {t.rich("night.show.tickets", {
                        ...tags,
                        sold: fmtInt(locale, v.night.nextShow.ticketsSold),
                        capacity: fmtInt(locale, v.night.nextShow.capacity),
                      })}
                    </>
                  ),
                },
                {
                  key: "todo",
                  kicker: t("night.todo.kicker"),
                  body: (
                    <>
                      {v.night.alert ? (
                        <>
                          {v.night.alert.message[locale === "fr" ? "fr" : "en"]}
                          {v.night.alert.dueDate ? (
                            <>
                              {" "}
                              <Emph tone="alert">
                                {fmtDate(locale, v.night.alert.dueDate, {
                                  day: "numeric",
                                  month: "long",
                                })}
                              </Emph>
                            </>
                          ) : null}{" "}
                        </>
                      ) : null}
                      {v.doors.splitsPending > 0
                        ? t.rich("night.todo.splits", {
                            ...tags,
                            count: v.doors.splitsPending,
                          })
                        : null}
                      {!v.night.alert && v.doors.splitsPending === 0 ? t("night.todo.none") : null}
                    </>
                  ),
                },
              ].filter(Boolean) as NightItem[]
            }
          />

          {/* Les deux fichiers qui rendraient tout exact. */}
          <ImportBand
            title={t("importBand.title")}
            status={
              <span className="text-muted-foreground text-[11px]">
                <ProvenanceBadge provenance={v.sharePct.provenance} className="mr-1.5 align-middle" />
                {t("importBand.status", { pct: `${fmtInt(locale, v.sharePct.pct)} %` })}
              </span>
            }
            body={t("importBand.body")}
            actions={
              <>
                <Button asChild size="sm">
                  <Link href="/import">{t("importBand.importStatement")}</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/revenue#shares">{t("importBand.importContract")}</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/rights">{t("importBand.askLabel")}</Link>
                </Button>
              </>
            }
          />

          <MoneyToCollect
            title={t("collect.title")}
            leads={
              [
                v.leads.gap > 0 && {
                  key: "audit",
                  family: "money",
                  href: "/audit",
                  label: t("collect.audit"),
                  amount: eur(v.leads.gap),
                },
                {
                  key: "sync",
                  href: "/sync",
                  label: t("collect.sync"),
                  /* Compté, pas écrit : 3 côté artiste et 5 côté label pour
                     la même liste de briefs, c'était l'un des deux qui mentait. */
                  amount: t("collect.syncValue", { count: syncOpen }),
                  deadline: t("collect.syncDeadline", { count: syncSoon }),
                },
                v.leads.rightsPending > 0 && {
                  key: "rights",
                  family: "money",
                  href: "/rights",
                  label: t("collect.rights"),
                  amount: eur(v.leads.rightsPending),
                },
              ].filter(Boolean) as MoneyLead[]
            }
          />

          {yearBand}

          <Doors
            title={t("doors.title")}
            doors={
              [
                v.doors.marketRow && {
                  key: "market",
                  family: "trends",
                  href: "/market",
                  label: t("doors.market"),
                  value: t("doors.marketValue", {
                    rank: v.doors.marketRow.topTrack?.rank ?? "—",
                    share: pct(v.doors.marketRow.share),
                  }),
                },
                {
                  key: "splits",
                  family: "catalog",
                  href: "/splits",
                  label: t("doors.splits"),
                  value: t("doors.splitsValue", { count: v.doors.splitsPending }),
                },
                {
                  key: "contracts",
                  family: "money",
                  href: "/contracts",
                  label: t("doors.contracts"),
                  value: t("doors.contractsValue", { count: v.doors.alerts.length }),
                  urgent: v.doors.alerts.some((a) => a.severity !== "info"),
                },
                {
                  key: "index",
                  family: "audience",
                  href: "/day1-index",
                  label: t("doors.index"),
                  value: `${v.artist.day1Index} / 100`,
                },
                v.doors.pnl && {
                  key: "pnl",
                  href: "/finances",
                  label: t("doors.pnl"),
                  value: t("doors.pnlValue", { margin: pct(v.doors.pnl.margin / 100) }),
                },
                {
                  key: "urssaf",
                  family: "money",
                  href: "/urssaf",
                  label: t("doors.urssaf"),
                  value: t("doors.urssafValue", { days: v.doors.urssafDue }),
                  urgent: v.doors.urssafDue <= 30,
                },
              ].filter(Boolean) as Door[]
            }
          />
          <p className="text-muted-foreground mt-2 text-[11.5px]">{t("legend.intro")}</p>
        </div>
      )}

      {l && (
        <div className="space-y-3">
          {/* Héros structure : le total à gauche, qui bouge à droite (gabarit I). */}
          <Sheet family="streams">
            <div className="grid items-center gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="text-center">
                <SheetHeading centered>{t("families.streamsLabel")}</SheetHeading>
                <p className="flex items-center justify-center gap-3 text-5xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-6xl">
                  <StreamGlyph size="lg" className="opacity-80" />
                  <span>{fmtCompact(locale, l.today)}</span>
                </p>
                <p className="sheet-ink mt-1.5 text-[13px]">
                  {t("hero.todayLabel", { count: ARTISTS.length })}{" "}
                  <b className={l.deltaToday >= 0 ? "text-success" : "text-destructive"}>
                    {fmtPct(locale, l.deltaToday)}
                  </b>{" "}
                  <ProvenanceBadge provenance="measured" className="align-middle" />
                </p>
                <Link
                  href="/streams"
                  className="sheet-ink mt-2 block text-[11px] underline underline-offset-2"
                >
                  {t("movers.range")} · {t("movers.detail")}
                </Link>
              </div>
              <div>
                <SheetHeading action={<Link href="/roster">{t("movers.see")}</Link>}>
                  {t("movers.title")}
                </SheetHeading>
                <div className="mt-1">
                  {l.movers.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFocusedArtistId(m.id)}
                      className={`grid w-full grid-cols-[1fr_auto_auto] items-baseline gap-4 py-1.5 text-left text-[12.5px] ${
                        i === 0 ? "sheet-rule" : "border-border/30 border-t"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <RankMedal rank={i + 1} size="sm" awarded={m.delta30d >= 0} />
                        <span className="truncate">{m.name}</span>
                      </span>
                      <span className="sheet-ink tabular-nums">
                        {fmtCompact(locale, m.streams30d)}
                      </span>
                      <b
                        className={`w-16 text-right font-semibold tabular-nums ${
                          m.delta30d >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {fmtPct(locale, m.delta30d)}
                      </b>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <AffiliatedPoints
              points={[
                {
                  key: "d7",
                  value: (
                    <>
                      {fmtCompact(locale, l.cur7)}{" "}
                      <span
                        className={`text-xs ${l.d7 >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {fmtPct(locale, l.d7)}
                      </span>
                    </>
                  ),
                  label: t("affiliated.d7"),
                },
                {
                  key: "d30",
                  value: fmtCompact(locale, l.s30),
                  label: t("affiliated.d30"),
                  note: t("affiliated.d30Note"),
                },
                ...(l.topEarner
                  ? [
                      {
                        key: "earner",
                        value: `${l.topEarner.name} · ${fmtInt(
                          locale,
                          Math.round(
                            (l.topEarner.revenue12m / Math.max(1, l.totals.revenue12m)) * 100,
                          ),
                        )} %`,
                        label: t("affiliated.earner"),
                        note: t("affiliated.earnerNote"),
                      } satisfies AffiliatedPoint,
                    ]
                  : []),
                {
                  key: "valuation",
                  value: eur(l.valuation),
                  label: t("money.valuation"),
                  note: t("legend.simulated"),
                },
              ]}
            />
          </Sheet>

          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
            <Sheet family="money">
              <SheetHeading
                action={<Link href={REVENUE_DETAIL_HREF}>{t("money.detail")}</Link>}
              >
                {t("families.moneyLabel")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {eur(l.est.day.grossMaster.mid)}
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("money.grossMaster")} · {t("money.yesterday")}{" "}
                <ProvenanceBadge provenance="estimated" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  {
                    key: "month",
                    label: t("money.monthCurrent"),
                    value: (
                      <>
                        {eur(l.revMonth)}{" "}
                        <span
                          className={`text-[11px] ${l.revDelta >= 0 ? "text-success" : "text-destructive"}`}
                        >
                          {fmtPct(locale, l.revDelta)}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "forecast",
                    label: (
                      <>
                        {t("money.monthForecast")}{" "}
                        <ProvenanceBadge provenance="estimated" className="align-middle" />
                      </>
                    ),
                    value: `≈ ${eur(l.revForecast)}`,
                  },
                  {
                    key: "expenses",
                    label: (
                      <>
                        {t("money.expenses")}{" "}
                        <span className="text-muted-foreground hidden text-[11px] sm:inline">
                          {t("money.expensesNote")}
                        </span>
                      </>
                    ),
                    value: `−${eur(l.monthExpenses)}`,
                  },
                  {
                    key: "result",
                    label: <b className="text-foreground">{t("money.leftLabel")}</b>,
                    value: (
                      <span className="text-base">
                        {eur(Math.max(0, l.revMonth - l.monthExpenses))}
                      </span>
                    ),
                  },
                ]}
              />
            </Sheet>

            <Sheet family="audience">
              <SheetHeading>{t("families.audienceLabel")}</SheetHeading>
              <p className="flex items-center gap-2.5 text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                <AudienceGlyph size="md" className="opacity-75" />
                <span>
                  {fmtCompact(locale, ARTISTS.reduce((s, a) => s + a.monthlyListeners, 0))}
                </span>
              </p>
              <p className="sheet-ink mt-1 text-xs">
                {t("audience.listenersLabel")}{" "}
                <ProvenanceBadge provenance="measured" className="align-middle" />
              </p>
              <AttachedLines
                lines={[
                  {
                    key: "index",
                    label: t("audience.indexLabel"),
                    value: `${Math.round(
                      ARTISTS.reduce((s, a) => s + a.day1Index, 0) / ARTISTS.length,
                    )} / 100`,
                  },
                  ...(l.night.tiktok
                    ? [
                        {
                          key: "tiktok",
                          label: (
                            <>
                              {t("audience.tiktokVideosLabel")}{" "}
                              <ProvenanceBadge provenance="simulated" className="align-middle" />
                            </>
                          ),
                          value: `${fmtCompact(locale, l.night.tiktok.videos)} · ${fmtSigned(locale, l.night.tiktok.deltaYesterday)}`,
                        },
                      ]
                    : []),
                  ...(l.night.topMover
                    ? [
                        {
                          key: "fastest",
                          label: t("audience.fastest"),
                          value: l.night.topMover.name,
                        },
                      ]
                    : []),
                ]}
              />
            </Sheet>

            <Sheet family="trends">
              <SheetHeading action={<ProvenanceBadge provenance="measured" />}>
                {t("families.trends")}
              </SheetHeading>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {fmtInt(locale, l.doors.rosterTracks)}
              </p>
              <p className="sheet-ink mt-1 text-xs">{t("trends.inTop200")}</p>
              <AttachedLines
                lines={[
                  ...l.doors.rosterMarket.slice(0, 2).map((r) => ({
                    key: r.key,
                    label: r.label,
                    value: t("trends.rank", { rank: r.topTrack?.rank ?? "—" }),
                  })),
                  {
                    key: "share",
                    label: t("trends.rosterShare"),
                    value: pct(l.doors.rosterShare),
                  },
                ]}
              />
            </Sheet>
          </div>

          <NightStrip
            items={
              [
                l.night.topMover && {
                  key: "accel",
                  kicker: t("night.weekLabel.kicker"),
                  body: (
                    <>
                      {t.rich("night.weekLabel.body", {
                        ...tags,
                        name: l.night.topMover.name,
                        delta: pct(Math.abs(l.night.topMover.delta30d) / 100),
                      })}{" "}
                      {l.topEarner
                        ? t.rich("night.weekLabel.earner", {
                            ...tags,
                            earner: l.topEarner.name,
                            share: `${fmtInt(
                              locale,
                              Math.round(
                                (l.topEarner.revenue12m / Math.max(1, l.totals.revenue12m)) * 100,
                              ),
                            )} %`,
                          })
                        : null}
                    </>
                  ),
                },
                l.night.tiktok && {
                  key: "push",
                  kicker: t("night.push.kicker"),
                  body: t.rich("night.push.bodyLabel", {
                    ...tags,
                    videos: fmtCompact(locale, l.night.tiktok.videos),
                    delta: fmtSigned(locale, l.night.tiktok.deltaYesterday),
                  }),
                  footer: (
                    <span className="text-muted-foreground text-[11px]">
                      {t("night.push.noteLabel")}{" "}
                      <ProvenanceBadge provenance="simulated" className="align-middle" />
                    </span>
                  ),
                },
                l.night.nextShow && {
                  key: "show",
                  kicker: t("night.show.kicker"),
                  body: (
                    <>
                      <Emph>{l.night.nextShow.artistName}</Emph> —{" "}
                      {t.rich("night.show.body", {
                        ...tags,
                        venue: l.night.nextShow.venue,
                        city: l.night.nextShow.city,
                        days: daysUntil(l.night.nextShow.date),
                      })}
                    </>
                  ),
                },
                {
                  key: "todo",
                  kicker: t("night.todo.kicker"),
                  body: (
                    <>
                      {t.rich("night.todo.alerts", { ...tags, count: l.night.alertCount })}{" "}
                      {t.rich("night.todo.splitsLabel", {
                        ...tags,
                        count: l.doors.splitsPending,
                      })}
                    </>
                  ),
                },
              ].filter(Boolean) as NightItem[]
            }
          />

          <ImportBand
            title={t("importBand.titleLabel")}
            status={
              <span className="text-muted-foreground text-[11px]">
                <ProvenanceBadge provenance="simulated" className="mr-1.5 align-middle" />
                {t("importBand.statusLabel", {
                  count: l.missingContracts,
                  total: ARTISTS.length,
                })}
              </span>
            }
            body={t("importBand.bodyLabel")}
            actions={
              <>
                <Button asChild size="sm">
                  <Link href="/contracts">{t("importBand.fillContracts")}</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/import">{t("importBand.importStatement")}</Link>
                </Button>
              </>
            }
          />

          <MoneyToCollect
            title={t("collect.title")}
            leads={
              [
                l.leads.gap > 0 && {
                  key: "audit",
                  family: "money",
                  href: "/audit",
                  label: t("collect.audit"),
                  amount: eur(l.leads.gap),
                },
                {
                  key: "sync",
                  href: "/sync",
                  label: t("collect.sync"),
                  amount: t("collect.syncValue", { count: syncOpen }),
                  deadline: t("collect.syncDeadline", { count: syncSoon }),
                },
                l.leads.rightsPending > 0 && {
                  key: "rights",
                  family: "money",
                  href: "/rights",
                  label: t("collect.rights"),
                  amount: eur(l.leads.rightsPending),
                },
              ].filter(Boolean) as MoneyLead[]
            }
          />

          {yearBand}

          <Doors
            title={t("doors.title")}
            doors={[
              {
                key: "market",
                family: "trends",
                href: "/market",
                label: t("doors.marketLabel"),
                value: t("doors.marketValueLabel", { share: pct(l.doors.rosterShare) }),
              },
              {
                key: "valuation",
                family: "catalog",
                href: "/valuation",
                label: t("doors.valuation"),
                value: eur(l.valuation),
              },
              {
                key: "splits",
                family: "catalog",
                href: "/splits",
                label: t("doors.splits"),
                value: t("doors.splitsValue", { count: l.doors.splitsPending }),
              },
              {
                key: "contracts",
                family: "money",
                href: "/contracts",
                label: t("doors.contracts"),
                value: t("doors.contractsValue", { count: l.doors.alertCount }),
                urgent: l.doors.alertCount > 0,
              },
              {
                key: "rights",
                family: "money",
                href: "/rights",
                label: t("doors.rights"),
                value: t("doors.rightsValue", { amount: eur(l.leads.rightsPending) }),
              },
              {
                key: "arwatch",
                family: "audience",
                href: "/ar-watch",
                label: t("doors.arwatch"),
                value: t("doors.arwatchValue", { count: EMERGING.length }),
              },
            ]}
          />
          <p className="text-muted-foreground mt-2 text-[11.5px]">{t("legend.intro")}</p>
        </div>
      )}
    </div>
  );
}
