"use client";

/**
 * /catalog — la source de vérité du répertoire : projets dépliables,
 * tracks (ISRC, durée, streams estimés, statut splits) + fiche track.
 * Persona artiste : son catalogue. Persona label : Select artiste / roster.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Clock3, Disc3, Search } from "lucide-react";
import {
  ARTISTS,
  PROJECTS,
  SPLITS,
  TRACKS,
  getArtist,
  sumStreams,
} from "@/lib/demo/api";
import type { Artist, Project, Track, TrackSplit } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { fmtCompact, fmtDate, fmtInt } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

/* ─────────────────────────── Helpers ─────────────────────────── */

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type SplitStatus = TrackSplit["status"];

const SPLIT_BADGE: Record<SplitStatus, string> = {
  signed: "border-transparent bg-success/10 text-success",
  pending: "border-transparent bg-warning/15 text-warning",
  draft: "border-transparent bg-muted text-muted-foreground",
};

function splitFor(trackId: string): TrackSplit | undefined {
  return SPLITS.find((s) => s.trackId === trackId);
}

type ScopedTrack = Track & { streams12m: number; splitStatus: SplitStatus };

/* ─────────────────────────── Vue ─────────────────────────── */

export function CatalogView() {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();
  const rosterMode = isLabel && focusedArtistId === null;

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [openTrackId, setOpenTrackId] = useState<string | null>(null);

  const scopeIds = useMemo(
    () => (rosterMode ? ARTISTS.map((a) => a.id) : [artistId]),
    [rosterMode, artistId],
  );

  /** Streams 12 mois par artiste du scope (base des estimations par titre). */
  const artistTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of scopeIds) m.set(id, sumStreams(id, 365));
    return m;
  }, [scopeIds]);

  const tracksByProject = useMemo(() => {
    const m = new Map<string, ScopedTrack[]>();
    for (const tr of TRACKS) {
      if (!artistTotals.has(tr.artistId)) continue;
      const list = m.get(tr.projectId) ?? [];
      list.push({
        ...tr,
        streams12m: Math.round((artistTotals.get(tr.artistId) ?? 0) * tr.weight),
        splitStatus: splitFor(tr.id)?.status ?? "draft",
      });
      m.set(tr.projectId, list);
    }
    for (const list of m.values()) list.sort((a, b) => b.streams12m - a.streams12m);
    return m;
  }, [artistTotals]);

  const projects = useMemo<Array<Project & { artist: Artist }>>(
    () =>
      PROJECTS.filter((p) => artistTotals.has(p.artistId))
        .map((p) => ({ ...p, artist: getArtist(p.artistId) }))
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
    [artistTotals],
  );

  /* KPIs */
  const allTracks = useMemo(
    () => Array.from(tracksByProject.values()).flat(),
    [tracksByProject],
  );
  const totalStreams = allTracks.reduce((s, tr) => s + tr.streams12m, 0);
  const topTrack = useMemo(
    () =>
      allTracks.length === 0
        ? null
        : allTracks.reduce((best, tr) => (tr.streams12m > best.streams12m ? tr : best)),
    [allTracks],
  );
  const topShare =
    topTrack && totalStreams > 0 ? (topTrack.streams12m / totalStreams) * 100 : 0;

  /* Recherche : titre, ISRC, projet */
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const visible = useMemo(() => {
    return projects
      .map((p) => {
        const tracks = tracksByProject.get(p.id) ?? [];
        if (!searching) return { project: p, tracks };
        const projectMatch = p.title.toLowerCase().includes(q);
        const matching = projectMatch
          ? tracks
          : tracks.filter(
              (tr) =>
                tr.title.toLowerCase().includes(q) ||
                tr.isrc.toLowerCase().includes(q),
            );
        return { project: p, tracks: matching };
      })
      .filter((x) => !searching || x.tracks.length > 0);
  }, [projects, tracksByProject, q, searching]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Fiche track (Dialog) */
  const openTrack = useMemo(() => {
    if (!openTrackId) return null;
    const tr = TRACKS.find((x) => x.id === openTrackId);
    if (!tr) return null;
    const artist = getArtist(tr.artistId);
    const project = PROJECTS.find((p) => p.id === tr.projectId);
    const total = artistTotals.get(tr.artistId) ?? sumStreams(tr.artistId, 365);
    return {
      track: tr,
      artist,
      project,
      streams12m: Math.round(total * tr.weight),
      split: splitFor(tr.id),
    };
  }, [openTrackId, artistTotals]);

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={rosterMode ? t("labelSubtitle") : t("subtitle")}
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
              <SelectItem value="all">{t("allArtists")}</SelectItem>
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
          id="catalog-tracks"
          label={t("kpis.tracks")}
          value={allTracks.length}
          format="int"
        />
        <KpiCard
          id="catalog-projects"
          label={t("kpis.projects")}
          value={projects.length}
          format="int"
        />
        <KpiCard
          id="catalog-streams"
          label={t("kpis.streams")}
          value={totalStreams}
          format="compact"
        />
        <KpiCard
          id="catalog-top-share"
          label={t("kpis.topShare")}
          value={topShare}
          format="pct"
          deltaLabel={topTrack?.title}
        />
      </div>

      {/* ─── Recherche ─── */}
      <div className="relative mt-4 max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      {/* ─── Projets ─── */}
      {visible.length === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map(({ project, tracks }) => {
            const isOpen = searching || expanded.has(project.id);
            const projectStreams = tracks.reduce((s, tr) => s + tr.streams12m, 0);
            return (
              <section
                key={project.id}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggle(project.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-4 text-left transition-colors hover:bg-surface-2/50 sm:px-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Disc3 className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {project.title}
                      </span>
                      <Badge variant="secondary">{t(`types.${project.type}`)}</Badge>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {rosterMode && <>{project.artist.name} · </>}
                      {t("project.releasedOn", {
                        date: fmtDate(locale, project.releaseDate),
                      })}{" "}
                      ·{" "}
                      {tracks.length === 1
                        ? t("project.oneTrack")
                        : t("project.tracks", { count: tracks.length })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("project.totalStreams")}
                    </span>
                    <span className="num text-sm font-semibold">
                      {fmtCompact(locale, projectStreams)}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div className="overflow-x-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("columns.track")}</TableHead>
                          <TableHead>{t("columns.isrc")}</TableHead>
                          <TableHead className="text-right">
                            {t("columns.duration")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.streams")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.splits")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tracks.map((tr) => (
                          <TableRow
                            key={tr.id}
                            className="cursor-pointer"
                            onClick={() => setOpenTrackId(tr.id)}
                          >
                            <TableCell className="font-medium">{tr.title}</TableCell>
                            <TableCell className="num text-xs text-muted-foreground">
                              {tr.isrc}
                            </TableCell>
                            <TableCell className="num text-right">
                              {mmss(tr.durationSec)}
                            </TableCell>
                            <TableCell className="num text-right font-medium">
                              {fmtCompact(locale, tr.streams12m)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className={SPLIT_BADGE[tr.splitStatus]}>
                                {t(`splits.${tr.splitStatus}`)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ─── Fiche track ─── */}
      <Dialog open={openTrack !== null} onOpenChange={(o) => !o && setOpenTrackId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {openTrack && (
            <>
              <DialogHeader>
                <DialogTitle>{openTrack.track.title}</DialogTitle>
                <DialogDescription>
                  {openTrack.artist.name}
                  {openTrack.project && <> · {openTrack.project.title}</>}
                  {openTrack.project && (
                    <> · {t(`types.${openTrack.project.type}`)}</>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("dialog.metadata")}
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border bg-surface-2/40 p-3 text-sm">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {t("dialog.isrc")}
                    </dt>
                    <dd className="num text-xs font-medium">{openTrack.track.isrc}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {t("dialog.duration")}
                    </dt>
                    <dd className="num font-medium">
                      {mmss(openTrack.track.durationSec)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {t("dialog.releaseDate")}
                    </dt>
                    <dd className="num font-medium">
                      {fmtDate(locale, openTrack.track.releaseDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {t("dialog.streams")}
                    </dt>
                    <dd className="num font-medium">
                      {fmtCompact(locale, openTrack.streams12m)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {t("dialog.weight")}
                    </dt>
                    <dd className="num font-medium">
                      {fmtCompact(locale, openTrack.track.weight * 100)} %
                    </dd>
                  </div>
                </dl>
              </div>

              {openTrack.split && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("dialog.splitsTitle")}
                    </h3>
                    <Badge className={SPLIT_BADGE[openTrack.split.status]}>
                      {t(`splits.${openTrack.split.status}`)}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {openTrack.split.shares.map((share) => (
                      <li key={`${share.name}-${share.role}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{share.name}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {t(`roles.${share.role}`)}
                            </span>
                          </span>
                          <span className="num shrink-0 font-semibold">
                            {fmtInt(locale, share.share)} %
                          </span>
                          {share.signed ? (
                            <Check
                              className="size-3.5 shrink-0 text-success"
                              aria-label={t("dialog.signed")}
                            />
                          ) : (
                            <Clock3
                              className="size-3.5 shrink-0 text-warning"
                              aria-label={t("dialog.pendingSignature")}
                            />
                          )}
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-brand/70"
                            style={{ width: `${share.share}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {t("dialog.updatedAt", {
                      date: fmtDate(locale, openTrack.split.updatedAt),
                    })}
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
