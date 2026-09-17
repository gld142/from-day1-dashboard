"use client";

/**
 * /splits — répartition des droits par titre.
 * Persona artiste : ses titres, et il peut signer ceux qui ne le sont pas
 * (signature locale à l'appareil). Persona label : groupé par artiste, statut
 * seulement.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ARTISTS, PROJECTS, SPLITS, TRACKS, getArtist } from "@/lib/demo/api";
import type { Project, Track, TrackSplit } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { getSignature, type SplitSignature } from "@/lib/userdata/signatures-store";
import { useSignaturesSnapshot } from "@/lib/userdata/use-signatures";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { SplitTrackCard } from "@/components/modules/droits/split-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SplitItem = {
  track: Track;
  project: Project;
  /** Split effectif : statut « signed » et part de l'artiste signée si une signature locale existe. */
  split: TrackSplit;
  signature: SplitSignature | null;
};
type StatusFilter = "all" | TrackSplit["status"];

const STATUS_ORDER: Record<TrackSplit["status"], number> = {
  pending: 0,
  draft: 1,
  signed: 2,
};

/**
 * Surcharge locale du statut de démo : un split signé sur cet appareil passe
 * en « signed » et la part de l'artiste lui-même est cochée.
 */
function withSignature(split: TrackSplit, signature: SplitSignature | null, artistName: string): TrackSplit {
  if (!signature) return split;
  return {
    ...split,
    status: "signed",
    shares: split.shares.map((s) => (s.name === artistName ? { ...s, signed: true } : s)),
  };
}

function itemsFor(artistId: string): SplitItem[] {
  const artistName = getArtist(artistId).name;
  return TRACKS.filter((t) => t.artistId === artistId)
    .map((track) => {
      const signature = getSignature(track.id);
      return {
        track,
        project: PROJECTS.find((p) => p.id === track.projectId)!,
        split: withSignature(SPLITS.find((s) => s.trackId === track.id)!, signature, artistName),
        signature,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.split.status] - STATUS_ORDER[b.split.status] ||
        b.track.releaseDate.localeCompare(a.track.releaseDate),
    );
}

export default function SplitsPage() {
  const t = useTranslations("splits");
  const { isLabel, artistId, focusedArtistId, persona } = useRole();
  const grouped = isLabel && !focusedArtistId;
  const [filter, setFilter] = useState<StatusFilter>("all");
  /* Signatures locales : les items se recalculent à chaque signature. */
  const signaturesKey = useSignaturesSnapshot();

  const groups = useMemo(() => {
    void signaturesKey;
    const ids = grouped ? ARTISTS.map((a) => a.id) : [artistId];
    return ids.map((id) => ({ artist: getArtist(id), items: itemsFor(id) }));
  }, [grouped, artistId, signaturesKey]);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const kpis = useMemo(() => {
    const count = (s: TrackSplit["status"]) =>
      allItems.filter((i) => i.split.status === s).length;
    const collaborators = new Set<string>();
    const artistNames = new Set(ARTISTS.map((a) => a.name));
    for (const item of allItems) {
      for (const share of item.split.shares) {
        if (!artistNames.has(share.name)) collaborators.add(share.name);
      }
    }
    return {
      signed: count("signed"),
      pending: count("pending"),
      draft: count("draft"),
      collaborators: collaborators.size,
    };
  }, [allItems]);

  const filtered = (items: SplitItem[]) =>
    filter === "all" ? items : items.filter((i) => i.split.status === filter);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">{t("filters.all")}</TabsTrigger>
            <TabsTrigger value="signed">{t("filters.signed")}</TabsTrigger>
            <TabsTrigger value="pending">{t("filters.pending")}</TabsTrigger>
            <TabsTrigger value="draft">{t("filters.draft")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard id="splits-signed" label={t("kpis.signed")} value={kpis.signed} format="int" />
        <KpiCard
          id="splits-pending"
          label={t("kpis.pending")}
          value={kpis.pending}
          format="int"
        />
        <KpiCard id="splits-draft" label={t("kpis.draft")} value={kpis.draft} format="int" />
        <KpiCard
          id="splits-collab"
          label={t("kpis.collaborators")}
          value={kpis.collaborators}
          format="int"
        />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {groups.map(({ artist, items }) => {
          const visible = filtered(items);
          const pendingCount = items.filter((i) => i.split.status !== "signed").length;
          return (
            <section key={artist.id}>
              {grouped && (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <ArtistBadge
                    artist={artist}
                    meta={t("labelView.meta", {
                      tracks: items.length,
                      pending: pendingCount,
                    })}
                  />
                </div>
              )}
              {visible.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  {t("empty")}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visible.map((item) => (
                    <SplitTrackCard
                      key={item.track.id}
                      track={item.track}
                      project={item.project}
                      split={item.split}
                      signature={item.signature}
                      canSign={persona === "artist"}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
