"use client";

/**
 * /fans — CRM fan : segments, entonnoir d'engagement, super-fans, activations.
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
import { DeltaChip, KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistAvatar, ArtistBadge } from "@/components/dashboard/artist-badge";
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
  const maxCount = Math.max(...segments.map((s) => s.count), 1);

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

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={rosterMode ? t("labelSubtitle") : t("subtitle")}
      />

      {/* ─── KPIs : les 4 segments ─── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {segments.map((seg) => (
          <KpiCard
            key={seg.id}
            id={`fans-${seg.id}`}
            label={t(`segments.${seg.id}.label`)}
            value={seg.count}
            format="compact"
            delta={seg.trend}
            deltaLabel={t("funnel.ofBase", {
              pct: `${fmtCompact(locale, (seg.count / totalFans) * 100)} %`,
            })}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* ─── Entonnoir d'engagement ─── */}
        <section className="rounded-xl border bg-card p-5 lg:col-span-3">
          <div className="mb-2">
            <h2 className="text-sm font-semibold">{t("funnel.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("funnel.description")}</p>
          </div>
          <div>
            {segments.map((seg) => (
              <div
                key={seg.id}
                className="flex flex-col gap-3 border-b py-4 last:border-0 last:pb-1 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: SEGMENT_COLORS[seg.id] }}
                    />
                    <span className="text-sm font-medium">
                      {t(`segments.${seg.id}.label`)}
                    </span>
                    <DeltaChip value={seg.trend} />
                    <span className="num ml-auto text-sm font-semibold">
                      {fmtCompact(locale, seg.count)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (seg.count / maxCount) * 100)}%`,
                        background: SEGMENT_COLORS[seg.id],
                        opacity: 0.9,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(`segments.${seg.id}.description`)}
                  </p>
                </div>
                <div className="shrink-0 sm:w-52 sm:text-right">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("funnel.suggested")}
                  </span>
                  <DemoButton
                    className="mt-1.5"
                    label={t(`segments.${seg.id}.action`)}
                    sentLabel={t("superfans.sent")}
                    icon={seg.id === "dormant" ? Sparkles : undefined}
                    variant={seg.id === "dormant" ? "secondary" : "outline"}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Super-fans ─── */}
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="mb-2">
            <h2 className="text-sm font-semibold">{t("superfans.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {rosterMode ? t("superfans.rosterDescription") : t("superfans.description")}
            </p>
          </div>
          <ul>
            {superfans.map((f) => (
              <li
                key={`${f.artist.id}-${f.name}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2/60"
              >
                <ArtistAvatar
                  artist={{ hue: f.hue, initials: f.initials, name: f.name }}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-medium">{f.name}</span>
                    {rosterMode && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        · {f.artist.name}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {f.city} · {f.platforms.join(" · ")}
                  </div>
                </div>
                <span
                  className="num shrink-0 text-xs font-semibold text-brand"
                  title={t("superfans.score")}
                >
                  {fmtInt(locale, f.score)}
                  <span className="text-[10px] font-normal text-muted-foreground">/100</span>
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
        </section>
      </div>

      {/* ─── Idées d'activation ─── */}
      <section className="mt-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{t("ideas.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("ideas.description")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ideas.map(({ key, icon: Icon, soon }) => (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/15"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                {soon && <Badge variant="secondary">{tc("actions.soon")}</Badge>}
              </div>
              <div className="text-sm font-medium">{t(`ideas.${key}.title`)}</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(`ideas.${key}.description`)}
              </p>
              {!soon && (
                <DemoButton
                  className="mt-auto self-start"
                  label={t("ideas.prepare")}
                  sentLabel={t("superfans.sent")}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Comparatif par artiste (label, vue roster) ─── */}
      {rosterMode && (
        <section className="mt-4 overflow-hidden rounded-xl border bg-card">
          <div className="p-5 pb-3">
            <h2 className="text-sm font-semibold">{t("table.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("table.description")}</p>
          </div>
          <div className="overflow-x-auto">
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
                      <ArtistBadge artist={row.artist} meta={row.artist.genre} size="sm" />
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
        </section>
      )}
    </div>
  );
}
