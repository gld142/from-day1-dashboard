"use client";

/**
 * /fans — qui écoute vraiment, et quoi leur envoyer. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Les quatre effectifs de segments s'affichaient ici **et** sur /audience, aux
 * mêmes chiffres et aux mêmes tendances. Ils vivent désormais ici seulement :
 * /audience garde le nombre de super-fans en point affilié et une porte vers
 * cette page. C'est la règle des portes d'entrée, appliquée à un bloc entier.
 *
 * Les effectifs ne sont plus répétés deux fois dans la page non plus : la barre
 * du héros et ses points affiliés les donnent une fois, et l'ancien « entonnoir »
 * ne garde que ce qu'il seul disait — la description d'un segment et l'action
 * qui lui correspond.
 *
 * Persona artiste : sa base fans. Persona label : agrégat roster + comparatif.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Disc3,
  Gift,
  Headphones,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { ARTISTS, fanSegments, getArtist } from "@/lib/demo/api";
import type { Artist, FanSegment } from "@/lib/demo/types";
import { useRole } from "@/lib/role";
import { fmtCompact, fmtInt } from "@/lib/format";
import { DeltaChip } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistAvatar, ArtistBadge } from "@/components/dashboard/artist-badge";
import { AudienceGlyph } from "@/components/dashboard/audience-glyph";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Constantes ─────────────────────────── */

const SEGMENT_ORDER = ["superfans", "engaged", "casual", "dormant"] as const;

const SEGMENT_COLORS: Record<FanSegment["id"], string> = {
  superfans: "var(--chart-1)",
  engaged: "var(--chart-2)",
  casual: "var(--chart-3)",
  dormant: "var(--chart-4)",
};

type DemoFan = {
  name: string;
  city: string;
  hue: number;
  platforms: string[];
  base: number;
};

/** Pool constant de fans fictifs — AUCUN aléa, tout est dérivé de l'artiste. */
const FAN_POOL: DemoFan[] = [
  { name: "Camille R.", city: "Paris", hue: 285, platforms: ["Spotify", "Instagram"], base: 98 },
  { name: "Yanis B.", city: "Lyon", hue: 215, platforms: ["Spotify", "TikTok"], base: 95 },
  { name: "Léa M.", city: "Bruxelles", hue: 165, platforms: ["Apple Music", "Instagram"], base: 93 },
  { name: "Hugo T.", city: "Montréal", hue: 35, platforms: ["Spotify", "YouTube"], base: 91 },
  { name: "Sofia D.", city: "Genève", hue: 330, platforms: ["Deezer", "Instagram"], base: 90 },
  { name: "Adam K.", city: "Marseille", hue: 10, platforms: ["Spotify", "Discord"], base: 88 },
  { name: "Nina P.", city: "Bordeaux", hue: 120, platforms: ["Apple Music", "TikTok"], base: 87 },
  { name: "Théo L.", city: "Lille", hue: 260, platforms: ["Spotify", "Instagram"], base: 85 },
  { name: "Maya F.", city: "Casablanca", hue: 60, platforms: ["YouTube", "Instagram"], base: 84 },
  { name: "Louis G.", city: "Nantes", hue: 190, platforms: ["Deezer", "Discord"], base: 82 },
];

type ScoredFan = DemoFan & { score: number; initials: string };

function superfansFor(artist: Artist, limit: number): ScoredFan[] {
  const start = artist.hue % FAN_POOL.length;
  return Array.from({ length: limit }, (_, i) => {
    const f = FAN_POOL[(start + i * 3) % FAN_POOL.length];
    return {
      ...f,
      score: Math.min(99, Math.max(72, f.base - ((artist.hue + i * 5) % 9))),
      initials: f.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase(),
    };
  }).sort((a, b) => b.score - a.score);
}

/* ─────────────────────────── Bouton démo ─────────────────────────── */

function DemoButton({
  label,
  sentLabel,
  icon: Icon,
  variant = "outline",
  className,
}: {
  label: string;
  sentLabel: string;
  icon?: LucideIcon;
  variant?: "outline" | "secondary";
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant={done ? "ghost" : variant}
      size="sm"
      className={cn(done && "pointer-events-none text-success", className)}
      onClick={() => setDone(true)}
    >
      {done ? <Check /> : Icon ? <Icon /> : null}
      {done ? sentLabel : label}
    </Button>
  );
}

function FanActionButton({
  icon: Icon,
  label,
  id,
  sent,
  onSend,
}: {
  icon: LucideIcon;
  label: string;
  id: string;
  sent: boolean;
  onSend: (id: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn(sent && "pointer-events-none text-success")}
      onClick={() => onSend(id)}
    >
      {sent ? <Check /> : <Icon />}
    </Button>
  );
}

/* ─────────────────────────── Vue ─────────────────────────── */

export function FansView() {
  const t = useTranslations("fans");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel } = useRole();
  const rosterMode = isLabel && focusedArtistId === null;

  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const markSent = (id: string) => setSent((prev) => new Set(prev).add(id));

  /* Segments (artiste zoomé ou agrégat roster) */
  const segments = useMemo<FanSegment[]>(() => {
    if (!rosterMode) return fanSegments(artistId);
    return SEGMENT_ORDER.map((id) => {
      let count = 0;
      let weighted = 0;
      for (const a of ARTISTS) {
        const seg = fanSegments(a.id).find((s) => s.id === id);
        if (!seg) continue;
        count += seg.count;
        weighted += seg.trend * seg.count;
      }
      return { id, count, trend: count === 0 ? 0 : weighted / count };
    });
  }, [rosterMode, artistId]);

  const totalFans = segments.reduce((s, seg) => s + seg.count, 0);

  /* Super-fans : liste déterministe dérivée de l'artiste (ou du roster) */
  const superfans = useMemo(() => {
    if (!rosterMode) {
      const artist = getArtist(artistId);
      return superfansFor(artist, 7).map((f) => ({ ...f, artist }));
    }
    const used = new Set<string>();
    const out: Array<ScoredFan & { artist: Artist }> = [];
    for (const a of ARTISTS) {
      for (const f of superfansFor(a, 3)) {
        if (used.has(f.name)) continue;
        used.add(f.name);
        out.push({ ...f, artist: a });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [rosterMode, artistId]);

  /* Comparatif roster (persona label, vue agrégée) */
  const byArtist = useMemo(() => {
    if (!rosterMode) return [];
    return ARTISTS.map((a) => {
      const segs = fanSegments(a.id);
      const get = (id: FanSegment["id"]) => segs.find((s) => s.id === id);
      return {
        artist: a,
        superfans: get("superfans"),
        engaged: get("engaged"),
        casual: get("casual"),
        dormant: get("dormant"),
        total: segs.reduce((s, x) => s + x.count, 0),
      };
    }).sort((x, y) => y.total - x.total);
  }, [rosterMode]);

  const ideas: Array<{
    key: "presale" | "vinyl" | "listening";
    icon: LucideIcon;
    soon: boolean;
  }> = [
    { key: "presale", icon: Ticket, soon: false },
    { key: "vinyl", icon: Disc3, soon: true },
    { key: "listening", icon: Headphones, soon: true },
  ];

  const superSeg = segments.find((s) => s.id === "superfans");
  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);
  const share = (n: number) => (totalFans === 0 ? 0 : (n / totalFans) * 100);

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={rosterMode ? t("labelSubtitle") : t("subtitle")}
      />

      <div className="space-y-3">
        {/* Combien de vrais fans, et ce que pèse le reste de la base. */}
        <Sheet family="audience">
          <SheetHeading>
            {rosterMode ? t("hero.titleLabel") : t("hero.title")}
          </SheetHeading>
          <p className="flex items-center gap-3 text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            <AudienceGlyph size="lg" className="opacity-80" />
            <span>{fmtCompact(locale, superSeg?.count ?? 0)}</span>
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.caption", {
              pct: pct(share(superSeg?.count ?? 0)),
              total: fmtCompact(locale, totalFans),
            })}
            {superSeg && (
              <>
                {" — "}
                <b
                  className={
                    superSeg.trend >= 0 ? "text-success" : "text-destructive"
                  }
                >
                  {t(superSeg.trend >= 0 ? "hero.trendUp" : "hero.trendDown", {
                    delta: pct(Math.abs(superSeg.trend)),
                  })}
                </b>
              </>
            )}
          </p>

          {/* Les quatre segments à l'échelle : une barre dit la forme de la
              base plus vite que quatre nombres alignés. */}
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
            {segments.map((seg) =>
              seg.count === 0 ? null : (
                <div
                  key={seg.id}
                  className="h-full"
                  style={{
                    width: `${share(seg.count)}%`,
                    background: SEGMENT_COLORS[seg.id],
                  }}
                  title={`${t(`segments.${seg.id}.label`)} · ${fmtCompact(locale, seg.count)}`}
                />
              ),
            )}
          </div>

          <AffiliatedPoints
            points={[
              ...segments
                .filter((seg) => seg.id !== "superfans")
                .map((seg) => ({
                  key: String(seg.id),
                  value: fmtCompact(locale, seg.count),
                  label: t(`segments.${seg.id}.label`),
                  note: t("kpis.share", { pct: pct(share(seg.count)) }),
                })),
              {
                key: "total",
                value: fmtCompact(locale, totalFans),
                label: t("kpis.total"),
                note: t("kpis.totalHint"),
              },
            ]}
          />
        </Sheet>

        {/* Ce qu'on fait de chacun — les effectifs sont déjà dits au-dessus. */}
        <Sheet family="audience">
          <SheetHeading action={t("funnel.description")}>
            {t("funnel.title")}
          </SheetHeading>
          <div className="mt-1">
            {segments.map((seg) => (
              <div
                key={seg.id}
                className="border-border/50 flex flex-col gap-2 border-t py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: SEGMENT_COLORS[seg.id] }}
                    />
                    {t(`segments.${seg.id}.label`)}
                    <DeltaChip value={seg.trend} />
                  </p>
                  <p className="sheet-ink mt-0.5 text-[11.5px] leading-relaxed">
                    {t(`segments.${seg.id}.description`)}
                  </p>
                </div>
                <DemoButton
                  className="shrink-0 self-start sm:self-auto"
                  label={t(`segments.${seg.id}.action`)}
                  sentLabel={t("superfans.sent")}
                  icon={seg.id === "dormant" ? Sparkles : undefined}
                  variant={seg.id === "dormant" ? "secondary" : "outline"}
                />
              </div>
            ))}
          </div>
        </Sheet>

        {/* Les super-fans, par leur nom. */}
        <Sheet family="audience">
          <SheetHeading
            action={
              rosterMode ? t("superfans.rosterDescription") : t("superfans.description")
            }
          >
            {t("superfans.listTitle")}
          </SheetHeading>
          <ul className="mt-1">
            {superfans.map((f) => (
              <li
                key={`${f.artist.id}-${f.name}`}
                className="border-border/50 flex items-center gap-3 border-t py-2 first:border-t-0"
              >
                <ArtistAvatar
                  artist={{ hue: f.hue, initials: f.initials, name: f.name }}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-medium">{f.name}</span>
                    {rosterMode && (
                      <span className="sheet-ink truncate text-[11px]">
                        · {f.artist.name}
                      </span>
                    )}
                  </div>
                  <div className="sheet-ink truncate text-[11px]">
                    {f.city} · {f.platforms.join(" · ")}
                  </div>
                </div>
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  title={t("superfans.score")}
                >
                  {fmtInt(locale, f.score)}
                  <span className="sheet-ink text-[10px] font-normal">/100</span>
                </span>
                <div className="flex shrink-0 items-center">
                  <FanActionButton
                    icon={Ticket}
                    label={t("superfans.invitePresale")}
                    id={`${f.artist.id}-${f.name}-presale`}
                    sent={sent.has(`${f.artist.id}-${f.name}-presale`)}
                    onSend={markSent}
                  />
                  <FanActionButton
                    icon={Gift}
                    label={t("superfans.exclusiveDrop")}
                    id={`${f.artist.id}-${f.name}-drop`}
                    sent={sent.has(`${f.artist.id}-${f.name}-drop`)}
                    onSend={markSent}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Sheet>

        {/* Ce qu'on peut lancer. */}
        <Sheet family="audience">
          <SheetHeading action={t("ideas.description")}>{t("ideas.title")}</SheetHeading>
          <div className="mt-1 grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {ideas.map(({ key, icon: Icon, soon }) => (
              <div key={key} className="border-border/50 border-t pt-2.5 sm:border-t-0 sm:pt-0">
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(`ideas.${key}.title`)}
                  {soon && <Badge variant="secondary">{tc("actions.soon")}</Badge>}
                </p>
                <p className="sheet-ink mt-0.5 text-[11.5px] leading-relaxed">
                  {t(`ideas.${key}.description`)}
                </p>
                {!soon && (
                  <DemoButton
                    className="mt-1.5"
                    label={t("ideas.prepare")}
                    sentLabel={t("superfans.sent")}
                  />
                )}
              </div>
            ))}
          </div>
        </Sheet>

        {/* Comparatif par artiste (label, vue roster). */}
        {rosterMode && (
          <Sheet family="audience">
            <SheetHeading action={t("table.description")}>
              {t("table.title")}
            </SheetHeading>
            <div className="mt-1 min-w-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.artist")}</TableHead>
                    {SEGMENT_ORDER.map((id) => (
                      <TableHead key={id} className="text-right">
                        {t(`segments.${id}.label`)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t("table.total")}</TableHead>
                    <TableHead className="text-right">{t("table.trend")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byArtist.map((row) => (
                    <TableRow key={row.artist.id}>
                      <TableCell>
                        <ArtistBadge
                          artist={row.artist}
                          meta={row.artist.genre}
                          size="sm"
                        />
                      </TableCell>
                      {SEGMENT_ORDER.map((id) => (
                        <TableCell key={id} className="num text-right">
                          {fmtCompact(locale, row[id]?.count ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="num text-right font-medium">
                        {fmtCompact(locale, row.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeltaChip value={row.superfans?.trend ?? 0} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Sheet>
        )}

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "audience",
              family: "audience",
              href: "/audience",
              label: t("doors.audience"),
              value: t("doors.audienceValue"),
            },
            {
              key: "tour",
              family: "catalog",
              href: "/tour",
              label: t("doors.tour"),
              value: t("doors.tourValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue"),
            },
            {
              key: "discovery",
              family: "trends",
              href: "/discovery",
              label: t("doors.discovery"),
              value: t("doors.discoveryValue"),
            },
            {
              key: "index",
              family: "trends",
              href: "/day1-index",
              label: t("doors.index"),
              value: t("doors.indexValue"),
            },
            {
              key: "streams",
              family: "streams",
              href: "/streams",
              label: t("doors.streams"),
              value: t("doors.streamsValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
