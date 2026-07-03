"use client";

/**
 * /tour — dates, remplissage, revenus live, top villes, reco de booking.
 * Persona artiste : ses dates. Persona label : toutes les dates + filtre.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, MapPin, Sparkles, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ARTISTS,
  countryBreakdown,
  getArtist,
  revenueSeries,
  tourDates,
} from "@/lib/demo/api";
import type { Artist, TourDate } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { fmtCompact, fmtDate, fmtEur, fmtInt, fmtMonth } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ─────────────────────────── Constantes ─────────────────────────── */

/** iso3 (countryBreakdown) → iso2 (TourDate.country). */
const ISO3_TO_ISO2: Record<string, string> = {
  FRA: "FR",
  BEL: "BE",
  CHE: "CH",
  CAN: "CA",
  USA: "US",
  DEU: "DE",
  GBR: "GB",
  MAR: "MA",
  SEN: "SN",
  CIV: "CI",
  ESP: "ES",
  ITA: "IT",
  NLD: "NL",
  BRA: "BR",
  JPN: "JP",
  MEX: "MX",
};

/** Ville suggérée par territoire (donnée métier, pas une chaîne UI). */
const CITY_SUGGEST: Record<string, { fr: string; en: string }> = {
  USA: { fr: "New York", en: "New York" },
  DEU: { fr: "Berlin", en: "Berlin" },
  GBR: { fr: "Londres", en: "London" },
  MAR: { fr: "Casablanca", en: "Casablanca" },
  SEN: { fr: "Dakar", en: "Dakar" },
  CIV: { fr: "Abidjan", en: "Abidjan" },
  ESP: { fr: "Madrid", en: "Madrid" },
  ITA: { fr: "Milan", en: "Milan" },
  NLD: { fr: "Amsterdam", en: "Amsterdam" },
  BRA: { fr: "São Paulo", en: "São Paulo" },
  JPN: { fr: "Tokyo", en: "Tokyo" },
  MEX: { fr: "Mexico", en: "Mexico City" },
};

type ScopedDate = TourDate & { artist: Artist };

function liveMonthly(ids: string[]): Array<{ month: string; amount: number }> {
  const acc = new Map<string, number>();
  for (const id of ids) {
    for (const p of revenueSeries(id, 24)) {
      if (p.source !== "live") continue;
      acc.set(p.month, (acc.get(p.month) ?? 0) + p.amount);
    }
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amount]) => ({ month, amount }));
}

/* ─────────────────────────── Vue ─────────────────────────── */

export function TourView() {
  const t = useTranslations("tour");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();
  const rosterMode = isLabel && focusedArtistId === null;

  const scopeIds = useMemo(
    () => (rosterMode ? ARTISTS.map((a) => a.id) : [artistId]),
    [rosterMode, artistId],
  );

  const dates = useMemo<ScopedDate[]>(
    () =>
      scopeIds.flatMap((id) => {
        const artist = getArtist(id);
        return tourDates(id).map((d) => ({ ...d, artist }));
      }),
    [scopeIds],
  );

  const upcoming = useMemo(
    () =>
      dates
        .filter((d) => d.status === "upcoming")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [dates],
  );
  const past = useMemo(
    () =>
      dates
        .filter((d) => d.status === "past")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dates],
  );

  /* KPIs */
  const fillRate = useMemo(() => {
    const sold = past.reduce((s, d) => s + d.ticketsSold, 0);
    const cap = past.reduce((s, d) => s + d.capacity, 0);
    return cap === 0 ? 0 : (sold / cap) * 100;
  }, [past]);

  const liveSeries = useMemo(() => liveMonthly(scopeIds), [scopeIds]);
  const liveRevenue12m = liveSeries.reduce((s, m) => s + m.amount, 0);

  const bestVenue = useMemo(
    () =>
      past.length === 0
        ? null
        : past.reduce((best, d) => (d.grossRevenue > best.grossRevenue ? d : best)),
    [past],
  );

  /* Top villes (revenus billetterie, toutes dates) */
  const topCities = useMemo(() => {
    const acc = new Map<string, { city: string; revenue: number; shows: number }>();
    for (const d of dates) {
      const cur = acc.get(d.city) ?? { city: d.city, revenue: 0, shows: 0 };
      cur.revenue += d.grossRevenue;
      cur.shows += 1;
      acc.set(d.city, cur);
    }
    return Array.from(acc.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [dates]);
  const maxCityRevenue = Math.max(...topCities.map((c) => c.revenue), 1);

  /* Reco booking : forte audience streaming × aucune date programmée */
  const recos = useMemo(() => {
    const toured = new Set(dates.map((d) => d.country));
    const acc = new Map<string, { iso3: string; nameFr: string; nameEn: string; streams: number }>();
    for (const id of scopeIds) {
      for (const c of countryBreakdown(id, 30)) {
        const cur = acc.get(c.iso3);
        if (cur) cur.streams += c.streams;
        else acc.set(c.iso3, { ...c });
      }
    }
    return Array.from(acc.values())
      .filter((c) => !toured.has(ISO3_TO_ISO2[c.iso3] ?? c.iso3) && CITY_SUGGEST[c.iso3])
      .sort((a, b) => b.streams - a.streams)
      .slice(0, 3);
  }, [dates, scopeIds]);

  const chartData = liveSeries.map((m) => ({
    label: fmtMonth(locale, m.month),
    amount: m.amount,
  }));

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={rosterMode || isLabel ? t("labelSubtitle") : t("subtitle")}
      >
        {isLabel && (
          <Select
            value={focusedArtistId ?? "all"}
            onValueChange={(v) => setFocusedArtistId(v === "all" ? null : v)}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.all")}</SelectItem>
              {ARTISTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {/* ─── KPIs ─── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="tour-upcoming"
          label={t("kpis.upcoming")}
          value={upcoming.length}
          format="int"
          deltaLabel={
            upcoming[0]
              ? `${fmtDate(locale, upcoming[0].date)} · ${upcoming[0].city}`
              : undefined
          }
        />
        <KpiCard
          id="tour-fill"
          label={t("kpis.fillRate")}
          value={fillRate}
          format="pct"
          deltaLabel={t("kpis.fillRateHint")}
        />
        <KpiCard
          id="tour-live-revenue"
          label={t("kpis.liveRevenue")}
          value={liveRevenue12m}
          format="eur"
          spark={liveSeries.map((m) => ({ value: m.amount }))}
          sparkColor="var(--chart-2)"
        />
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("kpis.bestVenue")}
            </span>
            <Trophy className="size-3.5 text-warning" aria-hidden />
          </div>
          <div className="truncate text-2xl font-semibold tracking-tight">
            {bestVenue ? bestVenue.venue : "—"}
          </div>
          {bestVenue && (
            <span className="text-[11px] text-muted-foreground">
              {bestVenue.city} ·{" "}
              <span className="num">
                {fmtEur(locale, bestVenue.grossRevenue, { compact: true })}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* ─── Timeline des dates ─── */}
        <section className="rounded-xl border bg-card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">{t("timeline.upcoming")}</h2>
          </div>

          {upcoming.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {t("timeline.empty")}
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((d) => {
                const fill = (d.ticketsSold / d.capacity) * 100;
                return (
                  <li
                    key={d.id}
                    className="rounded-lg border bg-surface-2/40 p-3 transition-colors hover:border-foreground/15"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="num text-sm font-semibold">
                        {fmtDate(locale, d.date)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-sm">
                        <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">
                          {d.city} · {d.venue}
                        </span>
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        {t("timeline.presale")}
                      </Badge>
                    </div>
                    {rosterMode && (
                      <div className="mt-2">
                        <ArtistBadge artist={d.artist} size="sm" />
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-3">
                      <Progress value={fill} className="h-1.5 flex-1" />
                      <span className="num shrink-0 text-xs font-medium">
                        {fmtInt(locale, Math.round(fill))} %
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="num">
                        {t("timeline.tickets", {
                          sold: fmtInt(locale, d.ticketsSold),
                          capacity: fmtInt(locale, d.capacity),
                        })}
                      </span>
                      <span>
                        {t("timeline.estRevenue")}{" "}
                        <span className="num font-medium text-foreground">
                          {fmtEur(locale, d.grossRevenue, { compact: true })}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Dates passées, compactes */}
          {past.length > 0 && (
            <>
              <h3 className="mb-1 mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("timeline.past")}
              </h3>
              <div className="-mx-5 overflow-x-auto px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("timeline.date")}</TableHead>
                      {rosterMode && <TableHead>{t("timeline.artist")}</TableHead>}
                      <TableHead>{t("timeline.city")}</TableHead>
                      <TableHead>{t("timeline.venue")}</TableHead>
                      <TableHead className="text-right">{t("timeline.fill")}</TableHead>
                      <TableHead className="text-right">{t("timeline.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {past.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="num whitespace-nowrap">
                          {fmtDate(locale, d.date)}
                        </TableCell>
                        {rosterMode && (
                          <TableCell>
                            <ArtistBadge artist={d.artist} size="sm" />
                          </TableCell>
                        )}
                        <TableCell>{d.city}</TableCell>
                        <TableCell className="text-muted-foreground">{d.venue}</TableCell>
                        <TableCell className="num text-right">
                          {fmtInt(locale, Math.round((d.ticketsSold / d.capacity) * 100))} %
                        </TableCell>
                        <TableCell className="num text-right font-medium">
                          {fmtEur(locale, d.grossRevenue, { compact: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        {/* ─── Colonne droite : chart + villes + reco ─── */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">{t("chart.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("chart.description")}</p>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.07} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => fmtCompact(locale, v)}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value) => [fmtEur(locale, Number(value)), t("timeline.revenue")]}
                  />
                  <Bar
                    dataKey="amount"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">{t("cities.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("cities.description")}</p>
            <ul className="mt-3 space-y-2.5">
              {topCities.map((c, i) => (
                <li key={c.city}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      <span className="num mr-2 text-xs text-muted-foreground">{i + 1}</span>
                      {c.city}
                    </span>
                    <span className="num shrink-0 text-sm font-semibold">
                      {fmtEur(locale, c.revenue, { compact: true })}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (c.revenue / maxCityRevenue) * 100)}%`,
                        background: "var(--chart-2)",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {recos.length > 0 && (
            <section className="brand-glow rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-brand" aria-hidden />
                  {t("reco.title")}
                </h2>
                <Badge variant="secondary">{t("reco.badge")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("reco.description")}</p>
              <ul className="mt-3 space-y-3">
                {recos.map((c) => {
                  const city = CITY_SUGGEST[c.iso3];
                  return (
                    <li key={c.iso3} className="text-sm">
                      <p className="leading-snug">
                        {t("reco.item", {
                          country: locale === "fr" ? c.nameFr : c.nameEn,
                          city: locale === "fr" ? city.fr : city.en,
                        })}
                      </p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {t("reco.streams", { streams: fmtCompact(locale, c.streams) })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
