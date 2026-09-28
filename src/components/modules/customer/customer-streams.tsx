"use client";

/**
 * /streams en mode client — les streams de l'artiste ouvert, mois par mois,
 * tels que le relevé distributeur les déclare. La page de démo (« Streams
 * live », courbes quotidiennes) reste intacte derrière le mot de passe : un
 * relevé mensuel ne dit rien d'« hier » ni du « direct ».
 */
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useCustomer } from "@/lib/customer-mode";
import { downloadCsv } from "@/lib/export";
import { countryRows, monthSeries, platformMixShift, platformRows, streamsSummary, trackRows, type MonthPoint } from "@/lib/userdata/statement-insights";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { catalogHealth, halfLives, spotifyThreshold } from "@/lib/kpi/statement";
import { KpiList } from "./kpi-ui";
import { DSP_LABEL, Dot, MonthBars, PlatformLegend, SimpleTable, platformColor, statementLine, useFormats } from "./shared";

export function CustomerStreams() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const view = useMemo(() => {
    if (!data) return null;
    return {
      points: monthSeries(data),
      summary: streamsSummary(data),
      platforms: platformRows(data).sort((a, b) => b.streams - a.streams),
      shift: platformMixShift(data),
      tracks: trackRows(data, 10).sort((a, b) => b.streams - a.streams),
      countries: countryRows(data, 10).sort((a, b) => b.streams - a.streams),
      health: catalogHealth(data),
      life: halfLives(data),
      spotify: spotifyThreshold(data),
    };
  }, [data]);

  if (!data || !view) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Streams" subtitle="Aucun relevé importé pour cet artiste." />
        <Link href="/import" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Importer un relevé</Link>
      </div>
    );
  }

  const { points, summary: s, platforms, shift, tracks, countries } = view;
  const missing = points.filter((p) => p.missing);
  const share = (n: number) => (s.total > 0 ? f.pct(n / s.total) : "—");
  // Le plus gros déplacement entre plateformes (en points de part), s'il est net.
  const moved = shift ? [...shift].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0] : null;

  const exportCsv = () =>
    downloadCsv<MonthPoint>(`day1-streams-${customer?.artistName ?? "artiste"}`, points, [
      { header: "Mois", cell: (p) => p.month },
      { header: "Streams", cell: (p) => (p.missing ? "" : p.streams) },
      ...platforms.map((pl) => ({ header: DSP_LABEL[pl.dsp] ?? pl.dsp, cell: (p: MonthPoint) => (p.missing ? "" : (p.streamsByDsp[pl.dsp] ?? 0)) })),
    ]);

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader title="Streams" subtitle={`${customer?.artistName ?? data.artistName} · ${statementLine(data, f.month, f.locale)}`}>
        <ExportMenu label="Exporter" csvLabel="Mois par mois (CSV)" printLabel="Imprimer / PDF" onExportCsv={exportCsv} />
      </PageHeader>

      <div className="space-y-3">
        <Sheet family="streams">
          <SheetHeading action={`${s.months} mois`}>Streams sur la période</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.compact(s.total)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {s.yoy
              ? `${f.month(s.yoy.month)} : ${f.pct(s.yoy.change, true)} par rapport à ${f.month(s.yoy.previous)}`
              : "Comparaison sur un an : il faut le même mois de l'année d'avant dans le relevé."}
          </p>
          <AffiliatedPoints
            points={[
              { key: "avg", value: f.compact(s.avgMonthly), label: "Par mois en moyenne" },
              { key: "best", value: s.best ? f.compact(s.best.value) : "—", label: "Meilleur mois", note: s.best ? f.month(s.best.month) : undefined },
              {
                key: "trend",
                value: s.trend3 === null ? "—" : f.pct(s.trend3, true),
                label: "Tendance 3 mois",
                note: s.trend3 === null ? "il faut 6 mois de relevé" : "3 derniers mois contre les 3 d'avant",
              },
              {
                key: "top",
                value: s.topPlatform ? f.pct(s.topPlatform.share) : "—",
                label: s.topPlatform ? `sur ${DSP_LABEL[s.topPlatform.dsp] ?? s.topPlatform.dsp}` : "Première plateforme",
              },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Streams tels que déclarés par ton distributeur, mois par mois.
        </p>

        <Sheet family="streams">
          <SheetHeading action="par plateforme">Mois par mois</SheetHeading>
          <MonthBars points={points} kind="streams" />
          <PlatformLegend dsps={platforms.map((p) => p.dsp)} />
          {missing.length > 0 && (
            <p className="sheet-ink mt-2 text-[11px]">
              Absent{missing.length > 1 ? "s" : ""} du relevé : {missing.map((p) => f.month(p.month)).join(", ")}.
            </p>
          )}
        </Sheet>

        <Sheet family="streams">
          <SheetHeading action={shift ? "3 premiers mois du relevé → 3 derniers" : undefined}>Par plateforme</SheetHeading>
          {moved && Math.abs(moved.after - moved.before) >= 0.05 && (
            <p className="mb-3 text-sm">
              {DSP_LABEL[moved.dsp] ?? moved.dsp} : {f.pct(moved.before)} → {f.pct(moved.after)} de tes streams.
            </p>
          )}
          <SimpleTable
            head={shift ? ["Plateforme", "Streams", "Part", "Part au début", "Part à la fin"] : ["Plateforme", "Streams", "Part"]}
            rows={platforms.map((p) => {
              const sh = shift?.find((x) => x.dsp === p.dsp);
              const base = [
                <span key="n" className="flex items-center gap-2"><Dot color={platformColor(p.dsp)} />{DSP_LABEL[p.dsp] ?? p.dsp}</span>,
                f.compact(p.streams),
                f.pct(p.streamsShare),
              ];
              return { key: p.dsp, cells: shift ? [...base, sh ? f.pct(sh.before) : "—", sh ? f.pct(sh.after) : "—"] : base };
            })}
          />
        </Sheet>

        <div className="grid gap-3 xl:grid-cols-2">
          <Sheet family="streams">
            <SheetHeading>Tes titres les plus écoutés</SheetHeading>
            {tracks.length === 0 ? (
              <p className="sheet-ink text-sm">Pas de titres dans ce relevé.</p>
            ) : (
              <SimpleTable
                head={["Titre", "Streams", "Part"]}
                rows={tracks.map((t) => ({
                  key: t.key,
                  cells: [<span key="t" className="block max-w-[16rem] truncate">{t.key}</span>, f.compact(t.streams), share(t.streams)],
                }))}
              />
            )}
          </Sheet>
          <Sheet family="streams">
            <SheetHeading>Où l&apos;on t&apos;écoute</SheetHeading>
            {countries.length === 0 ? (
              <p className="sheet-ink text-sm">Ce relevé ne précise pas les pays.</p>
            ) : (
              <SimpleTable
                head={["Pays", "Streams", "Part"]}
                rows={countries.map((c) => ({ key: c.key, cells: [f.country(c.key), f.compact(c.streams), share(c.streams)] }))}
              />
            )}
          </Sheet>
        </div>

        <Sheet family="catalog">
          <SheetHeading action="calculé sur ton relevé">Santé du catalogue</SheetHeading>
          <KpiList
            rows={[
              {
                key: "top1",
                label: "Dépendance au premier titre",
                value: view.health ? f.pct(view.health.top1Share) : null,
                formula: `part ${view.health?.basis === "revenue" ? "des revenus" : "des streams"} du titre n° 1 ; les 3 premiers : ${view.health ? f.pct(view.health.top3Share) : "—"}`,
                missing: "Pas de titres dans ce relevé.",
              },
              {
                key: "eq",
                label: "Titres qui comptent vraiment",
                value: view.health ? `${view.health.titlesFor80} pour 80 %` : null,
                formula: `nombre de titres qui font 80 % ${view.health?.basis === "revenue" ? "des revenus" : "des streams"} ; « équivalent » (1 ÷ Herfindahl) : ${view.health ? view.health.equivalentTitles.toLocaleString(f.locale, { maximumFractionDigits: 1 }) : "—"} titre(s)`,
                missing: "Pas de titres dans ce relevé.",
              },
              {
                key: "tail",
                label: "Longue traîne",
                value: view.health ? f.pct(view.health.outsideTop10Share) : null,
                formula: `part hors des 10 premiers titres ; ${view.health?.smallTitles ?? 0} titre(s) sous 1 000 streams sur la période`,
                missing: "Pas de titres dans ce relevé.",
              },
              {
                key: "half",
                label: "Demi-vie d'un titre",
                value: view.life.median !== null ? `${view.life.median} mois` : null,
                formula: `médiane du temps entre le pic d'un titre et le premier mois sous la moitié de ce pic (${view.life.titles.length - view.life.stillAbove} titre(s) mesuré(s) ; ${view.life.stillAbove} encore au-dessus de la moitié)`,
                missing:
                  data.trackMonthStreams === undefined
                    ? "Réimporte ton relevé : le détail mois par mois des titres est gardé depuis le 29/09."
                    : view.life.titles.length
                      ? `Aucun titre n'est encore passé sous la moitié de son pic (${view.life.stillAbove} suivi(s)).`
                      : "Il faut au moins 3 mois de recul après le pic d'un titre.",
              },
              {
                key: "spotify",
                label: "Sous le seuil Spotify",
                value: view.spotify ? `${view.spotify.below.length} titre(s) sur ${view.spotify.titles}` : null,
                formula: view.spotify
                  ? `moins de 1 000 streams Spotify sur ${view.spotify.fullYear ? "les 12 derniers mois" : `les ${view.spotify.window?.months ?? 0} derniers mois seulement (la règle porte sur 12)`} du relevé : Spotify ne rémunère plus ces titres depuis avril 2024${view.spotify.below.length ? ` — ${view.spotify.below.slice(0, 5).map((t) => `« ${t.title} » (${f.int(t.streams)})`).join(", ")}${view.spotify.below.length > 5 ? "…" : ""}` : ""}`
                  : "",
                missing: data.trackMonthStreams === undefined ? "Réimporte ton relevé : le détail Spotify par titre est gardé depuis le 29/09." : "Pas de streams Spotify dans ce relevé.",
              },
            ]}
          />
          {view.life.titles.length > 0 && (
            <div className="mt-4">
              <SimpleTable
                head={["Titre", "Pic", "Streams au pic", "Demi-vie"]}
                rows={view.life.titles.slice(0, 8).map((t) => ({
                  key: t.title,
                  cells: [<span key="t" className="block max-w-[16rem] truncate">{t.title}</span>, f.month(t.peakMonth), f.compact(t.peak), t.halfLife === null ? "pas encore" : `${t.halfLife} mois`],
                }))}
              />
            </div>
          )}
        </Sheet>
      </div>
    </div>
  );
}
