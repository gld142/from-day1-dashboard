"use client";

/**
 * /splits — qui touche quoi sur chaque titre. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Une seule question en haut : **combien de titres ont leur partage arrêté**,
 * et combien attendent encore une signature. La barre sous le chiffre montre
 * les trois états d'un coup ; le détail reste dans les cartes, une par titre,
 * parce qu'un titre est un objet et non une ligne de tableau.
 *
 * Persona artiste : ses titres, et il peut signer ceux qui ne le sont pas
 * (signature locale à l'appareil). Persona label : groupé par artiste.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ARTISTS, PROJECTS, SPLITS, TRACKS, getArtist } from "@/lib/demo/api";
import type { Project, Track, TrackSplit } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { getSignature, type SplitSignature } from "@/lib/userdata/signatures-store";
import { useSignaturesSnapshot } from "@/lib/userdata/use-signatures";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
  SheetSegments,
} from "@/components/dashboard/sheet";
import { SplitTrackCard } from "@/components/modules/droits/split-card";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";

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

/** La couleur de chaque état, tenue partout : barre, points, filtres. */
const STATUS_COLOR: Record<TrackSplit["status"], string> = {
  signed: "var(--success)",
  pending: "var(--warning)",
  draft: "color-mix(in oklab, var(--sheet-line) 45%, transparent)",
};

/**
 * Surcharge locale du statut de démo : un split signé sur cet appareil passe
 * en « signed » et la part de l'artiste lui-même est cochée.
 */
function withSignature(
  split: TrackSplit,
  signature: SplitSignature | null,
  artistName: string,
): TrackSplit {
  if (!signature) return split;
  return {
    ...split,
    status: "signed",
    shares: split.shares.map((s) =>
      s.name === artistName ? { ...s, signed: true } : s,
    ),
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
        split: withSignature(
          SPLITS.find((s) => s.trackId === track.id)!,
          signature,
          artistName,
        ),
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
  const tc = useTranslations("common");
  const locale = useLocale();
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
  const focusedArtist = isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  const facts = useMemo(() => {
    const count = (s: TrackSplit["status"]) =>
      allItems.filter((i) => i.split.status === s).length;
    const collaborators = new Set<string>();
    const artistNames = new Set(ARTISTS.map((a) => a.name));
    for (const item of allItems) {
      for (const share of item.split.shares) {
        if (!artistNames.has(share.name)) collaborators.add(share.name);
      }
    }
    /* La part que l'artiste garde en moyenne sur ses propres titres : le seul
       chiffre de cette page qui parle d'argent plutôt que de paperasse. */
    let ownTotal = 0;
    let ownCount = 0;
    for (const { artist, items } of groups) {
      for (const item of items) {
        const own = item.split.shares
          .filter((s) => s.name === artist.name)
          .reduce((sum, s) => sum + s.share, 0);
        if (own > 0) {
          ownTotal += own;
          ownCount += 1;
        }
      }
    }
    return {
      total: allItems.length,
      signed: count("signed"),
      pending: count("pending"),
      draft: count("draft"),
      collaborators: collaborators.size,
      avgOwnShare: ownCount === 0 ? null : ownTotal / ownCount,
      ownCount,
    };
  }, [allItems, groups]);

  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);
  const int = (n: number) => new Intl.NumberFormat(locale).format(n);

  const filtered = (items: SplitItem[]) =>
    filter === "all" ? items : items.filter((i) => i.split.status === filter);

  const unsigned = facts.pending + facts.draft;
  const bar: ReadonlyArray<{ status: TrackSplit["status"]; count: number }> = [
    { status: "signed", count: facts.signed },
    { status: "pending", count: facts.pending },
    { status: "draft", count: facts.draft },
  ];

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={
          grouped
            ? t("subtitleLabel")
            : focusedArtist
              ? t("subtitleFocused", { name: focusedArtist.name })
              : t("subtitle")
        }
      >
        {focusedArtist && <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />}
      </PageHeader>

      <div className="space-y-3">
        {/* Où en est la paperasse, d'un coup d'œil. */}
        <Sheet family="money">
          <SheetHeading>{t("hero.title")}</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {t("hero.value", { signed: int(facts.signed), total: int(facts.total) })}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.caption")}
            {" — "}
            {unsigned === 0 ? (
              <b className="text-success">{t("hero.allSigned")}</b>
            ) : (
              <b className="text-warning">{t("hero.toSign", { count: unsigned })}</b>
            )}
          </p>

          {/* Les trois états, à l'échelle : une barre dit « presque tout est
              signé » plus vite que trois nombres alignés. */}
          {facts.total > 0 && (
            <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
              {bar.map(({ status, count }) =>
                count === 0 ? null : (
                  <div
                    key={status}
                    className="h-full"
                    style={{
                      width: `${(count / facts.total) * 100}%`,
                      background: STATUS_COLOR[status],
                    }}
                    title={`${t(`status.${status}`)} · ${int(count)}`}
                  />
                ),
              )}
            </div>
          )}

          <AffiliatedPoints
            points={[
              {
                key: "pending",
                value: int(facts.pending),
                label: t("kpis.pending"),
              },
              {
                key: "draft",
                value: int(facts.draft),
                label: t("kpis.draft"),
              },
              {
                key: "collaborators",
                value: int(facts.collaborators),
                label: t("kpis.collaborators"),
                note: t("kpis.collaboratorsHint"),
              },
              {
                key: "share",
                value: facts.avgOwnShare === null ? "—" : pct(facts.avgOwnShare),
                label: grouped ? t("kpis.avgShareLabel") : t("kpis.avgShare"),
                note: t("kpis.avgShareHint", { count: facts.ownCount }),
              },
            ]}
          />
        </Sheet>

        {/* Les titres eux-mêmes. Chaque carte est un objet, pas une ligne. */}
        <section className="mt-1">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
              {grouped ? t("list.titleLabel") : t("list.title")}
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-muted-foreground text-[11.5px]">
                {t("list.hint")}
              </span>
              <SheetSegments
                value={filter}
                onChange={setFilter}
                label={t("filters.all")}
                className="[--sheet-line:var(--border)]"
                options={(["all", "signed", "pending", "draft"] as const).map((v) => ({
                  value: v as StatusFilter,
                  label: t(`filters.${v}`),
                }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {groups.map(({ artist, items }) => {
              const visible = filtered(items);
              const pendingCount = items.filter(
                (i) => i.split.status !== "signed",
              ).length;
              return (
                <div key={artist.id}>
                  {grouped && (
                    <div className="mb-2.5">
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
                    <div className="text-muted-foreground flex h-20 items-center justify-center rounded-xl border border-dashed text-sm">
                      {t("empty")}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                </div>
              );
            })}
          </div>
        </section>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "contracts",
              family: "money",
              href: "/contracts",
              label: t("doors.contracts"),
              value: t("doors.contractsValue"),
            },
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "revenue",
              family: "money",
              href: "/revenue",
              label: t("doors.revenue"),
              value: t("doors.revenueValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
            {
              key: "team",
              family: "catalog",
              href: "/team",
              label: t("doors.team"),
              value: t("doors.teamValue"),
            },
          ]}
        />

        <RestRow
          title={grouped ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "finances", href: "/finances", label: t("rest.finances") },
            { key: "calculator", href: "/calculator", label: t("rest.calculator") },
            { key: "valuation", href: "/valuation", label: t("rest.valuation") },
            { key: "urssaf", href: "/urssaf", label: t("rest.urssaf") },
            { key: "import", href: "/import", label: t("rest.import") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
