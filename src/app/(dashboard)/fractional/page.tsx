"use client";

/**
 * Fractional ownership — préversion Bolero/Anote.
 * Simulateur : vendre N % de ses royalties futures sur 2/3/5 ans,
 * calculé depuis la valorisation catalogue + le forecast de revenus.
 */

import { useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bus,
  CalendarClock,
  Clapperboard,
  Disc3,
  Hourglass,
  PiggyBank,
  Rocket,
  ShieldAlert,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { ARTISTS, catalogValuation, getArtist, revenueForecast } from "@/lib/demo/api";
import { artistColor, fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeltaChip } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistAvatar, ArtistBadge } from "@/components/dashboard/artist-badge";

const EUR_COMPACT = {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
} as const;

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/** Fraction du multiple plein cédée selon la durée (2/3/5 ans). */
const DURATION_FACTOR: Record<number, number> = { 2: 0.14, 3: 0.2, 5: 0.3 };
const DURATIONS = [2, 3, 5] as const;

/** Cas d'usage "pourquoi lever" — coûts fixes de référence. */
const USE_CASES = [
  { key: "clip", cost: 15_000, icon: Clapperboard },
  { key: "tour", cost: 40_000, icon: Bus },
  { key: "album", cost: 60_000, icon: Disc3 },
] as const;

const MAX_SHARE = 25;
const NEXT_PAYOUT_DATE = "2026-10-01"; // trimestriel — figé pour la démo

export default function FractionalPage() {
  const t = useTranslations("fractional");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

  const [pct, setPct] = useState(10);
  const [years, setYears] = useState<number>(3);
  const [simArtistId, setSimArtistId] = useState(ARTISTS[0].id);

  const effArtistId = aggregated ? simArtistId : artistId;
  const artist = getArtist(effArtistId);

  const sim = useMemo(() => {
    const v = catalogValuation(effArtistId);
    const midMultiple = (v.multipleLow + v.multipleHigh) / 2;
    const effMultiple = midMultiple * DURATION_FACTOR[years];
    const pctFrac = pct / 100;
    const raised = Math.round(v.nps * pctFrac * effMultiple);

    // Trajectoire de croissance ancrée sur le forecast 12 mois.
    const forecast = revenueForecast(effArtistId, { horizon: 12 });
    const projected = forecast
      .filter((p) => p.projected !== null)
      .reduce((s, p) => s + (p.projected ?? 0), 0);
    const npsNext = projected * 0.72;
    const ratio = Math.min(1.35, Math.max(0.9, v.nps === 0 ? 1 : npsNext / v.nps));

    // Flux annuels (point médian de chaque année).
    const yearFlows = Array.from({ length: years }, (_, i) => {
      const annual = v.nps * Math.pow(ratio, i + 0.5);
      return { investor: annual * pctFrac, artist: annual * (1 - pctFrac) };
    });
    const investorTotal = yearFlows.reduce((s, f) => s + f.investor, 0);
    const artistTotal = yearFlows.reduce((s, f) => s + f.artist, 0);

    // Break-even investisseur : cumul des flux vs montant investi.
    let breakEven = years;
    let cum = 0;
    for (let i = 0; i < yearFlows.length; i++) {
      const f = yearFlows[i].investor;
      if (cum + f >= raised) {
        breakEven = i + (raised - cum) / f;
        break;
      }
      cum += f;
    }

    // Série trimestrielle pour le chart empilé.
    const points = Array.from({ length: years * 4 + 1 }, (_, q) => {
      const tYear = q / 4;
      const annual = v.nps * Math.pow(ratio, tYear);
      return {
        t: tYear,
        artist: Math.round(annual * (1 - pctFrac)),
        investor: Math.round(annual * pctFrac),
      };
    });

    const roi = raised === 0 ? 0 : ((investorTotal - raised) / raised) * 100;

    return {
      v,
      effMultiple,
      raised,
      investorPerYear: Math.round(investorTotal / years),
      artistPerYear: Math.round(artistTotal / years),
      breakEven,
      roi,
      points,
      quarterlyPayout: Math.round(yearFlows[0].investor / 4),
    };
  }, [effArtistId, pct, years]);

  // Cas d'usage : % à céder pour financer chaque projet, à valo constante.
  const useCases = useMemo(
    () =>
      USE_CASES.map((uc) => ({
        ...uc,
        pctNeeded:
          sim.v.nps * sim.effMultiple === 0
            ? 0
            : (uc.cost / (sim.v.nps * sim.effMultiple)) * 100,
      })),
    [sim],
  );

  // Portefeuille label : levable théorique au plafond de 25 %.
  const portfolio = useMemo(() => {
    if (!aggregated) return null;
    const rows = ARTISTS.map((a) => {
      const va = catalogValuation(a.id);
      const mid = (va.multipleLow + va.multipleHigh) / 2;
      return {
        artist: a,
        max: Math.round(va.nps * (MAX_SHARE / 100) * mid * DURATION_FACTOR[years]),
      };
    }).sort((a, b) => b.max - a.max);
    return { rows, total: rows.reduce((s, r) => s + r.max, 0) };
  }, [aggregated, years]);

  const fmt1 = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {!aggregated && isLabel && <ArtistBadge artist={artist} size="md" />}
      </PageHeader>

      {/* ─── Bandeau préversion ─── */}
      <div className="rise-in mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand/10 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15">
          <Rocket className="size-4 text-brand" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{t("banner.title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("banner.body")}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-brand/50 text-brand">
          {tCommon("actions.soon")}
        </Badge>
      </div>

      {/* ─── Portefeuille label (vue agrégée) ─── */}
      {portfolio && (
        <section className="rise-in mb-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <PiggyBank className="size-4 text-brand" aria-hidden />
                {t("portfolio.title")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("portfolio.subtitle", { years })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">{t("portfolio.total")}</p>
              <p className="num text-2xl font-semibold tracking-tight">
                <NumberFlow value={portfolio.total} format={EUR_COMPACT} locales={locale} />
              </p>
            </div>
          </div>
          <p className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("portfolio.perArtist")}
          </p>
          <div className="flex flex-col">
            {portfolio.rows.map(({ artist: a, max }) => {
              const barW = portfolio.total === 0 ? 0 : (max / portfolio.total) * 100;
              return (
                <button
                  key={a.id}
                  onClick={() => setSimArtistId(a.id)}
                  className={cn(
                    "hairline-b group flex items-center gap-3 py-2.5 text-left transition-colors last:shadow-none hover:bg-surface-2",
                    a.id === simArtistId && "bg-surface-2",
                  )}
                >
                  <ArtistBadge artist={a} size="sm" className="w-44 shrink-0" />
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barW}%`, background: artistColor(a.hue) }}
                      />
                    </div>
                  </div>
                  <span className="num w-24 text-right text-sm font-semibold">
                    {fmtEur(locale, max, { compact: true })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Simulateur ─── */}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        {/* Paramètres */}
        <aside className="rise-in rounded-xl border bg-card p-5 lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold">{t("params.title")}</h2>
          <p className="mb-5 text-xs text-muted-foreground">{t("params.subtitle")}</p>

          <div className="space-y-5">
            {aggregated && (
              <div className="grid gap-2">
                <Label>{t("params.artist")}</Label>
                <Select value={simArtistId} onValueChange={setSimArtistId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTISTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="fractional-share">{t("params.share")}</Label>
                <span className="num text-sm font-semibold text-brand">
                  <NumberFlow
                    value={pct}
                    locales={locale}
                    format={{ maximumFractionDigits: 0 }}
                    suffix=" %"
                  />
                </span>
              </div>
              <input
                id="fractional-share"
                type="range"
                min={5}
                max={MAX_SHARE}
                step={1}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
                aria-label={t("params.share")}
              />
              <div className="num flex justify-between text-[10px] text-muted-foreground">
                <span>5 %</span>
                <span>{MAX_SHARE} %</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t("params.duration")}</Label>
              <Select value={String(years)} onValueChange={(v) => setYears(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {t("params.years", { count: y })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="num rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {t("params.basis", {
                nps: fmtEur(locale, sim.v.nps, { compact: true }),
                pct,
                multiple: fmt1(sim.effMultiple),
                years,
              })}
            </p>
          </div>
        </aside>

        {/* Résultats */}
        <div className="flex flex-col gap-4">
          <div className="rise-in brand-glow flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-b from-card to-surface-2 py-8">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Wallet className="size-3.5 text-brand" aria-hidden />
              {t("results.raised")}
            </span>
            <span className="num text-5xl font-semibold tracking-tight">
              <NumberFlow value={sim.raised} format={EUR_COMPACT} locales={locale} />
            </span>
          </div>

          <div className="rise-in grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("results.investorPerYear")}</p>
              <p className="num mt-1 text-xl font-semibold">
                <NumberFlow
                  value={sim.investorPerYear}
                  format={EUR_COMPACT}
                  locales={locale}
                />
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("results.artistKeeps")}</p>
              <p className="num mt-1 text-xl font-semibold">
                <NumberFlow
                  value={sim.artistPerYear}
                  format={EUR_COMPACT}
                  locales={locale}
                />
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hourglass className="size-3" aria-hidden />
                {t("results.breakEven")}
              </p>
              <p className="num mt-1 text-xl font-semibold">
                <NumberFlow
                  value={sim.breakEven}
                  locales={locale}
                  format={{ maximumFractionDigits: 1 }}
                  suffix={t("results.yearsSuffix")}
                />
              </p>
            </div>
          </div>

          {/* Chart flux empilés */}
          <section className="rise-in rounded-xl border bg-card p-5">
            <h2 className="font-heading text-base font-semibold">{t("chart.title")}</h2>
            <p className="mb-3 text-xs text-muted-foreground">{t("chart.subtitle")}</p>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sim.points}
                  margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                >
                  <defs>
                    <linearGradient id="frac-artist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="frac-investor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeOpacity={0.07} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[0, years]}
                    ticks={Array.from({ length: years + 1 }, (_, i) => i)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => fmt1(v)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      fmtEur(locale, Number(value)),
                      name === "artist"
                        ? t("chart.artistShare")
                        : t("chart.investorShare"),
                    ]}
                    labelFormatter={(l) =>
                      t("chart.atYear", { years: fmt1(Number(l)) })
                    }
                  />
                  <ReferenceLine
                    x={sim.breakEven}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="investor"
                    stackId="flows"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    fill="url(#frac-investor)"
                    animationDuration={600}
                  />
                  <Area
                    type="monotone"
                    dataKey="artist"
                    stackId="flows"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#frac-artist)"
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: "var(--chart-1)" }}
                  aria-hidden
                />
                {t("chart.artistShare")}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: "var(--chart-4)" }}
                  aria-hidden
                />
                {t("chart.investorShare")}
              </span>
              <span>{t("chart.breakEvenMark")}</span>
            </div>
          </section>
        </div>
      </div>

      {/* ─── Pourquoi lever ─── */}
      <section className="rise-in mt-4">
        <div className="mb-3">
          <h2 className="font-heading text-base font-semibold">{t("useCases.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("useCases.subtitle")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {useCases.map(({ key, cost, icon: Icon, pctNeeded }) => {
            const over = pctNeeded > MAX_SHARE;
            return (
              <div key={key} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                    <Icon className="size-4 text-brand" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {t(`useCases.${key}`)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t(`useCases.${key}Desc`)}
                    </p>
                  </div>
                </div>
                <p className="num mt-4 text-2xl font-semibold tracking-tight">
                  {fmtEur(locale, cost, { compact: true })}
                </p>
                <p
                  className={cn(
                    "num mt-1 flex items-center gap-1 text-xs",
                    over ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {over && <TriangleAlert className="size-3" aria-hidden />}
                  {over ? (
                    t("useCases.overCap")
                  ) : (
                    <>
                      <span className="font-semibold text-brand">
                        {fmt1(pctNeeded)} %
                      </span>{" "}
                      {t("useCases.cede", { years })}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* ─── Vue investisseur (preview) ─── */}
        <section className="rise-in rounded-xl border bg-gradient-to-b from-card to-surface-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">{t("investor.title")}</h2>
            <Badge variant="outline" className="rounded-full border-brand/50 text-brand">
              {t("investor.preview")}
            </Badge>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">{t("investor.subtitle")}</p>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <ArtistAvatar artist={artist} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {artist.name}
                </p>
                <p className="text-[11px] text-muted-foreground">{artist.genre}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">{t("investor.held")}</p>
                <p className="num text-lg font-semibold text-brand">
                  <NumberFlow
                    value={pct}
                    locales={locale}
                    format={{ maximumFractionDigits: 0 }}
                    suffix=" %"
                  />
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t("investor.invested")}
                </p>
                <p className="num mt-0.5 text-sm font-semibold">
                  {fmtEur(locale, sim.raised, { compact: true })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t("investor.roi")}</p>
                <p className="mt-0.5">
                  <DeltaChip value={sim.roi} />
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarClock className="size-3" aria-hidden />
                  {t("investor.nextPayout")}
                </p>
                <p className="num mt-0.5 text-sm font-semibold">
                  {fmtEur(locale, sim.quarterlyPayout, { compact: true })}
                </p>
                <p className="num text-[10px] text-muted-foreground">
                  {fmtDate(locale, NEXT_PAYOUT_DATE, { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Disclaimer conformité ─── */}
        <section className="rise-in flex items-start gap-3 rounded-xl border border-warning/40 bg-card p-5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            <h2 className="font-heading text-sm font-semibold">{t("disclaimer.title")}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {t("disclaimer.body")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
