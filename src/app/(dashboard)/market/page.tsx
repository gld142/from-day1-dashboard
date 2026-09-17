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
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
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
  const indiesDelta = indies.reduce((s, r) => s + r.delta7d, 0);
  const identified = 1 - shareOf("other") - shareOf("unknown");
  const totalStreams = byGroup.reduce((s, r) => s + r.streams, 0);
  /** La major en tête porte la tuile « héros » — pas la première de la liste. */
  const leadingMajor = (["universal", "sony", "warner"] as const).reduce((best, g) =>
    shareOf(g) > shareOf(best) ? g : best,
  );

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
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="font-medium">{t("empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-medium text-foreground">
            {t("header.chartDate", {
              date: fmtDate(locale, meta.chartDate ?? meta.date, { day: "numeric", month: "long", year: "numeric" }),
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

      {/* Périmètre + légende de provenance */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border bg-surface-2/40 px-4 py-3 text-xs text-muted-foreground">
        <p>{t("header.scope")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-medium text-foreground">{t("legend.title")}</span>
          {(["measured", "declared", "estimated"] as const).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <ProvenanceBadge provenance={p} />
              <span>{t(`legend.${p}`)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* KPI : majors, grands indés, autres labels */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(["universal", "sony", "warner"] as const).map((g) => (
          <KpiCard
            key={g}
            id={`market-${g}`}
            hero={g === leadingMajor}
            label={t(`kpi.${g}`)}
            value={shareOf(g) * 100}
            format="pct"
            provenance="measured"
            deltaLabel={vs7d(deltaOf(g))}
          />
        ))}
        <KpiCard
          id="market-indies"
          label={t("kpi.indies")}
          value={indiesShare * 100}
          format="pct"
          provenance="measured"
          deltaLabel={`${vs7d(indiesDelta)} · ${t("kpi.indiesHint")}`}
        />
        <KpiCard
          id="market-other"
          label={t("kpi.other")}
          value={shareOf("other") * 100}
          format="pct"
          provenance="measured"
          deltaLabel={`${vs7d(deltaOf("other"))} · ${t("kpi.otherHint")}`}
        />
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        {t("kpi.identified", { share: fmtShare(locale, identified) })}
        {" · "}
        {t("kpi.unknownLabels", { count: meta.unknownLabels })}
      </p>

      {/* Contrôles : dimensions (cases à cocher) + métrique */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("controls.dims")}</span>
          <div
            role="group"
            aria-label={t("controls.dims")}
            className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px]"
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
                    checked ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-3.5 items-center justify-center rounded-[4px] border",
                      checked ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {checked && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  {t(`dims.${d}`)}
                  {checked && dims.length > 1 && (
                    <span className="num text-[10px] text-muted-foreground">{order}</span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="hidden text-xs text-muted-foreground xl:inline">{t("controls.dimsHint")}</span>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as MarketMetric)}>
          <TabsList aria-label={t("controls.metric")}>
            {METRICS.map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">
                {t(`metric.${m}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Barre empilée des parts par groupe */}
          <section className="rounded-xl border bg-card p-5">
            <header>
              <h2 className="font-heading text-base font-semibold tracking-tight">{t("bar.title")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("bar.subtitle", {
                  tracks: meta.tracks,
                  streams: fmtCompact(locale, totalStreams),
                  metric: t(`metric.${metric}`),
                })}
              </p>
            </header>
            <div className="mt-4">
              <MarketGroupBar rows={byGroup} />
            </div>
          </section>

          <MarketSharesTable dims={dims} metric={metric} rosterNames={rosterNames} />
        </div>

        {reading && <MarketReading reading={reading} />}
      </div>
    </div>
  );
}
