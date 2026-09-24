"use client";

/**
 * /tour — dates, remplissage, revenus live, top villes, reco de booking.
 * Persona artiste : ses dates. Persona label : toutes les dates + filtre.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
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
  tourDates,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { Artist, TourDate } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { fmtCompact, fmtDate, fmtEur, fmtInt, fmtMonth, fmtPct } from "@/lib/format";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
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

/**
 * La billetterie brute par mois, sommée sur les DATES PASSÉES de la page.
 *
 * Mesuré : la série venait de `revenueSeries(source: "live")`, c'est-à-dire de
 * ce que l'artiste ENCAISSE — un cachet, une fraction de la recette. Sous un
 * titre qui dit « billetterie brute », Kiko affichait 438 € sur douze mois à
 * côté d'une « meilleure salle » à 54,4 k €, lue sur les mêmes concerts.
 * Deux générateurs indépendants pour un même fait : c'est le titre qui dit
 * lequel est le bon, et il dit « brut ».
 *
 * Ce que l'artiste touche reste sur /revenue, ligne « live », et n'a pas à
 * égaler la recette du guichet.
 */
function grossMonthly(dates: TourDate[]): Array<{ month: string; amount: number }> {
  const acc = new Map<string, number>();
  const depuis = isoMonth12mAgo();
  for (const d of dates) {
    if (d.status !== "past") continue;
    const month = d.date.slice(0, 7);
    if (month < depuis) continue;
    acc.set(month, (acc.get(month) ?? 0) + d.grossRevenue);
  }
  /* Les mois sans date doivent exister : sinon la courbe relie deux concerts
     distants par une pente, et laisse croire à une saison continue. */
  const out: Array<{ month: string; amount: number }> = [];
  const d = new Date(`${depuis}-01T00:00:00Z`);
  for (let i = 0; i < 12; i++) {
    const m = d.toISOString().slice(0, 7);
    out.push({ month: m, amount: acc.get(m) ?? 0 });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/** Premier des douze derniers mois, au format « AAAA-MM ». */
function isoMonth12mAgo(): string {
  const d = new Date(DEMO_TODAY);
  d.setUTCMonth(d.getUTCMonth() - 11);
  return d.toISOString().slice(0, 7);
}

/* ─────────────────────────── Vue ─────────────────────────── */

export function TourView() {
  const t = useTranslations("tour");
  const tc = useTranslations("common");
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

  const liveSeries = useMemo(() => grossMonthly(dates), [dates]);
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

      <div className="space-y-3">
      {/* Ce que le live rapporte, et l'état des dates. */}
      <Sheet family="catalog">
        <SheetHeading action={t("hero.caption")}>{t("hero.title")}</SheetHeading>
        <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
          {fmtEur(locale, liveRevenue12m, { compact: liveRevenue12m >= 100_000 })}
        </p>
        <AffiliatedPoints
          className="mt-2"
          points={[
            {
              key: "upcoming",
              value: String(upcoming.length),
              label: t("kpis.upcoming"),
              note: upcoming[0]
                ? t("kpis.upcomingHint", {
                    date: fmtDate(locale, upcoming[0].date),
                    city: upcoming[0].city,
                  })
                : t("kpis.upcomingNone"),
            },
            {
              key: "fill",
              value: fmtPct(locale, fillRate).replace("+", ""),
              label: t("kpis.fillRate"),
              note: t("kpis.fillRateHint"),
            },
            {
              key: "venue",
              value: bestVenue ? bestVenue.venue : "—",
              label: t("kpis.bestVenue"),
              note: bestVenue
                ? t("kpis.bestVenueHint", {
                    city: bestVenue.city,
                    amount: fmtEur(locale, bestVenue.grossRevenue, { compact: true }),
                  })
                : undefined,
            },
            {
              /* `past`, pas `dates` : ce dernier contient aussi les dates à
                 venir, et le point affichait 13 là où 8 dates sont passées. */
              key: "dates",
              value: String(past.length),
              label: t("timeline.past"),
              note: t("chart.description"),
            },
          ]}
        />
      </Sheet>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* ─── Timeline des dates ─── */}
        <Sheet family="catalog" className="lg:col-span-3">
          <SheetHeading>{t("timeline.upcoming")}</SheetHeading>

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
        </Sheet>

        {/* ─── Colonne droite : chart + villes + reco ─── */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Sheet family="catalog">
            <SheetHeading action={t("chart.description")}>
              {t("chart.title")}
            </SheetHeading>
            <div className="mt-1 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
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
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Sheet>

          <Sheet family="catalog">
            <SheetHeading action={t("cities.description")}>
              {t("cities.title")}
            </SheetHeading>
            <ul className="mt-1 space-y-2.5">
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
          </Sheet>

          {recos.length > 0 && (
            <Sheet family="trends">
              <SheetHeading action={t("reco.badge")}>{t("reco.title")}</SheetHeading>
              <p className="sheet-ink text-[11.5px]">{t("reco.description")}</p>
              <ul className="mt-2 space-y-2.5">
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
                      <p className="sheet-ink mt-0.5 text-xs tabular-nums">
                        {t("reco.streams", { streams: fmtCompact(locale, c.streams) })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Sheet>
          )}
        </div>
      </div>

      <Doors
        title={tc("blocks.doors")}
        doors={[
          { key: "audience", family: "audience", href: "/audience", label: t("doors.audience"), value: t("doors.audienceValue") },
          { key: "fans", family: "audience", href: "/fans", label: t("doors.fans"), value: t("doors.fansValue") },
          { key: "revenue", family: "money", href: "/revenue", label: t("doors.revenue"), value: t("doors.revenueValue") },
          { key: "finances", family: "money", href: "/finances", label: t("doors.finances"), value: t("doors.financesValue") },
          { key: "catalog", family: "catalog", href: "/catalog", label: t("doors.catalog"), value: t("doors.catalogValue") },
          { key: "contracts", family: "money", href: "/contracts", label: t("doors.contracts"), value: t("doors.contractsValue") },
        ]}
      />
      <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
