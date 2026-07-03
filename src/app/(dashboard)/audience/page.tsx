"use client";

/**
 * /audience — qui écoute, où, et comment ils découvrent.
 * Persona artiste : sa fanbase. Persona label : comparatif roster agrégé,
 * ou zoom sur l'artiste focus.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ARTISTS, getArtist } from "@/lib/demo/api";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { AudienceRosterTable } from "@/components/modules/data/audience-roster-table";
import { Demographics } from "@/components/modules/data/demographics";
import {
  aggregateWeekly,
  combinedDailyTotals,
  followersFor,
  segmentsFor,
  weightedGrowth,
} from "@/components/modules/data/derive";
import { DiscoveryDonut } from "@/components/modules/data/discovery-donut";
import { FanSegments } from "@/components/modules/data/fan-segments";
import { TopCities } from "@/components/modules/data/top-cities";

export default function AudiencePage() {
  const t = useTranslations("audience");
  const { artistId, focusedArtistId, isLabel } = useRole();

  const aggregate = isLabel && !focusedArtistId;
  const ids = useMemo(
    () => (aggregate ? ARTISTS.map((a) => a.id) : [artistId]),
    [aggregate, artistId],
  );
  const focusedArtist =
    isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  const listeners = useMemo(
    () => ids.reduce((s, id) => s + getArtist(id).monthlyListeners, 0),
    [ids],
  );
  const followers = useMemo(() => followersFor(ids), [ids]);
  const segments = useMemo(() => segmentsFor(ids), [ids]);
  const superfans = segments.find((s) => s.id === "superfans");
  const growth = useMemo(() => weightedGrowth(ids), [ids]);

  /* Forme d'écoute des 90 derniers jours — proxy visuel de la fanbase. */
  const spark = useMemo(
    () =>
      aggregateWeekly(combinedDailyTotals(ids, 90)).map((p) => ({
        value: p.streams,
      })),
    [ids],
  );

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {focusedArtist && (
          <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />
        )}
      </PageHeader>

      {/* Rangée KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="aud-listeners"
          hero
          label={t("kpi.listeners")}
          value={listeners}
          delta={growth}
          spark={spark}
        />
        <KpiCard
          id="aud-followers"
          label={t("kpi.followers")}
          value={followers}
          deltaLabel={t("kpi.followersHint")}
        />
        <KpiCard
          id="aud-superfans"
          label={t("kpi.superfans")}
          value={superfans?.count ?? 0}
          delta={superfans?.trend}
          deltaLabel={t("kpi.superfansHint")}
        />
        <KpiCard
          id="aud-growth"
          label={t("kpi.growth")}
          value={growth}
          format="pct"
          deltaLabel={t("kpi.growthHint")}
        />
      </div>

      {/* Comparatif roster (vue label agrégée) */}
      {aggregate && (
        <div className="mt-4">
          <AudienceRosterTable />
        </div>
      )}

      {/* Segments de fans */}
      <div className="mt-6">
        <FanSegments ids={ids} />
      </div>

      {/* Démographie + top villes */}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Demographics ids={ids} />
        </div>
        <div className="xl:col-span-2">
          <TopCities ids={ids} />
        </div>
      </div>

      {/* Sources de découverte */}
      <div className="mt-4">
        <DiscoveryDonut ids={ids} />
      </div>
    </div>
  );
}
