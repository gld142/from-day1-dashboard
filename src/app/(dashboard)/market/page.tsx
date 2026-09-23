"use client";

/**
 * /market — Marché : parts du Top 200 Spotify France par groupe, artiste et
 * genre (relevé Kworb quotidien + labels ℗ / © lus sur Spotify), et lecture du
 * matin à base de règles. Même vue pour les deux personas.
 *
 * Honnêteté du périmètre : ce sont les streams Spotify France des 200 titres
 * du classement du jour, pas le marché total ; le groupe est celui que cite
 * le ℗ / © — un label distribué sous licence sans le dire reste « Indé / autre ».
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import {
  ARTISTS,
  marketMeta,
  marketReading,
  marketShares,
  type MarketDimension,
  type MarketMetric,
} from "@/lib/demo/api";
import { MARKET_INDIES } from "@/lib/real";
import { fmtCompact, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { RankMedal } from "@/components/dashboard/rank-medal";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketGroupBar } from "@/components/modules/data/market-group-bar";
import { MarketReading } from "@/components/modules/data/market-reading";
import { MarketSharesTable } from "@/components/modules/data/market-shares-table";
import { fmtPoints, fmtShare } from "@/components/modules/data/market-shared";

const DIMS: MarketDimension[] = ["group", "artist", "genre"];
const METRICS: MarketMetric[] = ["streams", "streams7d"];

export default function MarketPage() {
  const locale = useLocale();
  const t = useTranslations("market");
  const tc = useTranslations("common");

  const [metric, setMetric] = useState<MarketMetric>("streams");
  /** Dimensions cochées, dans l'ordre de sélection : la première groupe, la suivante détaille. */
  const [dims, setDims] = useState<MarketDimension[]>(["group"]);
  const toggleDim = (d: MarketDimension) =>
    setDims((cur) => {
      if (!cur.includes(d)) return [...cur, d];
      // Au moins une dimension cochée.
      return cur.length === 1 ? cur : cur.filter((x) => x !== d);
    });

  const meta = useMemo(() => marketMeta(), []);
  const reading = useMemo(() => marketReading(), []);
  const byGroup = useMemo(() => marketShares("group", { metric }), [metric]);
  const rosterNames = useMemo(() => new Set(ARTISTS.map((a) => a.name.toLowerCase())), []);

  const shareOf = (key: string) => byGroup.find((r) => r.key === key)?.share ?? 0;
  const deltaOf = (key: string) => byGroup.find((r) => r.key === key)?.delta7d ?? 0;
  const indies = byGroup.filter((r) => (MARKET_INDIES as readonly string[]).includes(r.key));
  const indiesShare = indies.reduce((s, r) => s + r.share, 0);
  const identified = 1 - shareOf("other") - shareOf("unknown");
  const totalStreams = byGroup.reduce((s, r) => s + r.streams, 0);
  /** La major en tête porte la tuile « héros » — pas la première de la liste. */
  const leadingMajor = (["universal", "sony", "warner"] as const).reduce((best, g) =>
    shareOf(g) > shareOf(best) ? g : best,
  );

  /* Ce que le classement dit de l'utilisateur : sa part, ses titres classés et
     le mieux placé d'entre eux. Absent du Top 200 = un fait à dire, pas un
     zéro à afficher. */
  const mine = useMemo(() => {
    const rows = marketShares("artist", { metric }).filter((r) =>
      rosterNames.has(r.label.toLowerCase()),
    );
    const share = rows.reduce((s, r) => s + r.share, 0);
    const tracks = rows.reduce((s, r) => s + r.tracks, 0);
    const best = rows
      .map((r) => r.topTrack)
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.rank - b.rank)[0];
    return { present: rows.length > 0, share, tracks, best };
  }, [metric, rosterNames]);

  const capturedTime = meta
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(
        new Date(meta.capturedAt),
      )
    : "";
  const vs7d = (delta: number) => t("kpi.vs7d", { delta: fmtPoints(locale, delta) });

  if (!meta) {
    return (
      <div className="rise-in">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="border-border bg-card rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t("empty.title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <div className="text-muted-foreground text-right text-xs">
          <div className="text-foreground font-medium">
            {t("header.chartDate", {
              date: fmtDate(locale, meta.chartDate ?? meta.date, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </div>
          <div>
            {t("header.captured", {
              date: fmtDate(locale, meta.date, { day: "numeric", month: "short" }),
              time: capturedTime,
            })}
          </div>
        </div>
      </PageHeader>

      <div className="space-y-3">
        {/* Ta place dans le marché — le seul chiffre de cette page qui parle de
            toi ; le reste est le paysage dans lequel il se situe. */}
        <Sheet family="trends">
          <SheetHeading action={t("mine.scope")}>{t("mine.title")}</SheetHeading>
          {mine.present ? (
            <>
              <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
                {fmtShare(locale, mine.share)}
              </p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                {t("mine.caption", { count: mine.tracks })}{" "}
                <ProvenanceBadge provenance="measured" className="align-middle" />
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl leading-none font-semibold tracking-[-0.03em]">
                {t("mine.absentValue")}
              </p>
              <p className="sheet-ink mt-1.5 text-[13px]">{t("mine.absentHint")}</p>
            </>
          )}
          <AffiliatedPoints
            points={[
              ...(mine.best
                ? [
                    {
                      key: "best",
                      value: (
                        <span className="inline-flex items-center gap-2">
                          <RankMedal rank={mine.best.rank} size="sm" />
                          {mine.best.title}
                        </span>
                      ),
                      label: t("mine.bestTrack"),
                      note: t("mine.bestTrackNote", {
                        artist: mine.best.artist,
                        streams: fmtCompact(locale, mine.best.streams),
                      }),
                    },
                  ]
                : []),
              {
                key: "leader",
                value: `${t(`groups.${leadingMajor}`)} · ${fmtShare(locale, shareOf(leadingMajor))}`,
                label: t("mine.leader"),
                note: vs7d(deltaOf(leadingMajor)),
              },
              {
                key: "indies",
                value: fmtShare(locale, indiesShare),
                label: t("kpi.indies"),
                note: t("kpi.indiesHint"),
              },
              {
                key: "other",
                value: fmtShare(locale, shareOf("other")),
                label: t("kpi.other"),
                note: t("kpi.otherHint"),
              },
            ]}
          />
        </Sheet>

        {/* Le paysage : qui pèse quoi, et sur quelle métrique. */}
        <Sheet family="trends">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SheetHeading>
              {t("bar.subtitle", {
                tracks: meta.tracks,
                streams: fmtCompact(locale, totalStreams),
                metric: t(`metric.${metric}`),
              })}
            </SheetHeading>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as MarketMetric)}>
              <TabsList className="h-7" aria-label={t("controls.metric")}>
                {METRICS.map((m) => (
                  <TabsTrigger key={m} value={m} className="px-2.5 text-[11px]">
                    {t(`metric.${m}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <MarketGroupBar rows={byGroup} />
          <p className="sheet-ink mt-2.5 text-[11.5px]">
            {t("kpi.identified", { share: fmtShare(locale, identified) })}
            {" · "}
            {t("kpi.unknownLabels", { count: meta.unknownLabels })}
          </p>
        </Sheet>

        {/* Ce que la page mesure, et d'où viennent les libellés. */}
        <section className="border-border bg-card text-muted-foreground flex flex-col gap-2 rounded-xl border px-4.5 py-3 text-xs">
          <p>{t("header.scope")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-foreground font-medium">{t("legend.title")}</span>
            {(["measured", "declared", "estimated"] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <ProvenanceBadge provenance={p} />
                <span>{t(`legend.${p}`)}</span>
              </span>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Les dimensions du tableau vivent au-dessus de lui. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {t("controls.dims")}
              </span>
              <div
                role="group"
                aria-label={t("controls.dims")}
                className="bg-muted inline-flex h-8 items-center rounded-lg p-[3px]"
              >
                {DIMS.map((d) => {
                  const checked = dims.includes(d);
                  const order = dims.indexOf(d) + 1;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleDim(d)}
                      className={cn(
                        "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                        checked
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-3.5 items-center justify-center rounded-[4px] border",
                          checked
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {checked && <Check className="size-2.5" strokeWidth={3} />}
                      </span>
                      {t(`dims.${d}`)}
                      {checked && dims.length > 1 && (
                        <span className="num text-muted-foreground text-[10px]">{order}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="text-muted-foreground hidden text-xs xl:inline">
                {t("controls.dimsHint")}
              </span>
            </div>

            <MarketSharesTable dims={dims} metric={metric} rosterNames={rosterNames} />
          </div>

          {reading && <MarketReading reading={reading} />}
        </div>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "algo",
              href: "/algo-position",
              label: t("doors.algo"),
              family: "trends",
              value: t("doors.algoValue"),
            },
            {
              key: "streams",
              href: "/streams",
              label: t("doors.streams"),
              family: "streams",
              value: t("doors.streamsValue"),
            },
            {
              key: "audience",
              href: "/audience",
              label: t("doors.audience"),
              family: "audience",
              value: t("doors.audienceValue"),
            },
            {
              key: "arwatch",
              href: "/ar-watch",
              label: t("doors.arwatch"),
              family: "audience",
              value: t("doors.arwatchValue"),
            },
            {
              key: "sync",
              href: "/sync",
              label: t("doors.sync"),
              family: "money",
              value: t("doors.syncValue"),
            },
            {
              key: "discovery",
              href: "/discovery",
              label: t("doors.discovery"),
              family: "catalog",
              value: t("doors.discoveryValue"),
            },
          ]}
        />

        <RestRow
          title={tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "revenue", href: "/revenue", label: t("rest.revenue") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
            { key: "index", href: "/day1-index", label: t("rest.index") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
