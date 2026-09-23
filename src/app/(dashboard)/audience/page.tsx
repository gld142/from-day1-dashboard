"use client";

/**
 * /audience — qui écoute, où, et comment ils découvrent. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Pulse donne le nombre d'auditeurs ; cette page dit **de qui il s'agit** :
 * l'intensité de leur engagement, leur âge, leurs villes, et par quel chemin
 * ils sont arrivés. Aucun chiffre de Pulse n'est répété en héros.
 *
 * Pas de graphique sous le chiffre clé, contrairement aux autres héros : l'API
 * ne fournit que la valeur courante des auditeurs mensuels, aucun historique.
 * Poser une courbe de streams sous un chiffre d'auditeurs laisserait croire
 * qu'on mesure l'évolution de l'audience — on ne l'a pas.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ARTISTS, getArtist } from "@/lib/demo/api";
import { fmtCompact, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { AudienceGlyph } from "@/components/dashboard/audience-glyph";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AudienceRosterTable } from "@/components/modules/data/audience-roster-table";
import { Demographics } from "@/components/modules/data/demographics";
import {
  followersFor,
  segmentsFor,
  topCities as topCitiesFor,
  weightedGrowth,
} from "@/components/modules/data/derive";
import { DiscoveryDonut } from "@/components/modules/data/discovery-donut";
import { FanSegments } from "@/components/modules/data/fan-segments";
import { TopCities } from "@/components/modules/data/top-cities";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";

export default function AudiencePage() {
  const t = useTranslations("audience");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel } = useRole();

  const aggregate = isLabel && !focusedArtistId;
  const ids = useMemo(
    () => (aggregate ? ARTISTS.map((a) => a.id) : [artistId]),
    [aggregate, artistId],
  );
  const focusedArtist = isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  const listeners = useMemo(
    () => ids.reduce((s, id) => s + getArtist(id).monthlyListeners, 0),
    [ids],
  );
  const followers = useMemo(() => followersFor(ids), [ids]);
  const segments = useMemo(() => segmentsFor(ids), [ids]);
  const superfans = segments.find((s) => s.id === "superfans");
  const growth = useMemo(() => weightedGrowth(ids), [ids]);
  const topCity = useMemo(() => topCitiesFor(ids, 1)[0], [ids]);

  /** Part des superfans dans la fanbase — ce que « 93 k » ne dit pas seul. */
  const fanbase = Math.max(
    1,
    segments.reduce((s, seg) => s + seg.count, 0),
  );
  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {focusedArtist && <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />}
      </PageHeader>

      <div className="space-y-3">
        {/* Combien, et ce que ce nombre recouvre. */}
        <Sheet family="audience">
          <SheetHeading>{tc("families.audience")}</SheetHeading>
          <p className="flex items-center gap-3 text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            <AudienceGlyph size="lg" className="opacity-80" />
            <span>{fmtCompact(locale, listeners)}</span>
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("kpi.listeners")}{" "}
            <b className={growth >= 0 ? "text-success" : "text-destructive"}>
              {fmtPct(locale, growth)}
            </b>{" "}
            <span className="opacity-75">{t("kpi.growthHint")}</span>{" "}
            <ProvenanceBadge provenance="measured" className="align-middle" />
          </p>
          <AffiliatedPoints
            points={[
              {
                key: "followers",
                value: fmtCompact(locale, followers),
                label: t("kpi.followers"),
                note: t("kpi.followersHint"),
              },
              {
                key: "superfans",
                value: fmtCompact(locale, superfans?.count ?? 0),
                label: t("kpi.superfans"),
                note: t("kpi.superfansShare", {
                  share: pct(((superfans?.count ?? 0) / fanbase) * 100),
                }),
              },
              {
                key: "fanbase",
                value: fmtCompact(locale, fanbase),
                label: t("kpi.fanbase"),
                note: t("kpi.fanbaseHint"),
              },
              ...(topCity
                ? [
                    {
                      key: "city",
                      value: locale === "fr" ? topCity.nameFr : topCity.nameEn,
                      label: t("kpi.topCity"),
                      note: t("kpi.topCityHint", {
                        listeners: fmtCompact(locale, topCity.listeners),
                      }),
                    },
                  ]
                : []),
            ]}
          />
        </Sheet>

        {/* L'intensité de l'engagement : le cœur du sujet de cette page. */}
        <Sheet family="audience">
          <SheetHeading action={t("segments.subtitle")}>{t("segments.title")}</SheetHeading>
          <FanSegments ids={ids} bare />
        </Sheet>

        {/* Qui ils sont, et où ils sont. */}
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Sheet family="audience">
            <SheetHeading action={t("demo.subtitle")}>{t("demo.title")}</SheetHeading>
            <Demographics ids={ids} bare />
          </Sheet>
          <Sheet family="audience">
            <SheetHeading action={t("demo.citiesHint")}>{t("demo.cities")}</SheetHeading>
            <TopCities ids={ids} bare />
          </Sheet>
        </div>

        {/* Par quel chemin ils arrivent : c'est de l'algorithme et des
            tendances, pas de l'audience — d'où la couleur. */}
        <Sheet family="trends">
          <SheetHeading action={t("discovery.subtitle")}>{t("discovery.title")}</SheetHeading>
          <DiscoveryDonut ids={ids} bare />
        </Sheet>

        {aggregate && <AudienceRosterTable />}

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "fans",
              href: "/fans",
              label: t("doors.fans"),
              family: "audience",
              value: t("doors.fansValue", {
                count: fmtCompact(locale, superfans?.count ?? 0),
              }),
            },
            {
              key: "streams",
              href: "/streams",
              label: t("doors.streams"),
              family: "streams",
              value: t("doors.streamsValue"),
            },
            {
              key: "market",
              href: "/market",
              label: t("doors.market"),
              family: "trends",
              value: t("doors.marketValue"),
            },
            {
              key: "algo",
              href: "/algo-position",
              label: t("doors.algo"),
              family: "trends",
              value: t("doors.algoValue"),
            },
            {
              key: "index",
              href: "/day1-index",
              label: t("doors.index"),
              family: "audience",
              value: t("doors.indexValue"),
            },
            {
              key: "tour",
              href: "/tour",
              label: t("doors.tour"),
              family: "catalog",
              value: t("doors.tourValue"),
            },
          ]}
        />

        <RestRow
          title={aggregate ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "revenue", href: "/revenue", label: t("rest.revenue") },
            { key: "sync", href: "/sync", label: t("rest.sync") },
            { key: "discovery", href: "/discovery", label: t("rest.discoveryLab") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
