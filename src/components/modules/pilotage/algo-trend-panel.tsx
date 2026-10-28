"use client";

/**
 * Position algo & tendances — SIMULATION de démo (badge obligatoire).
 *
 * Ce que l'algorithme fait d'un artiste ce matin, plateforme par plateforme, et le son
 * TikTok qui a percé : quand, combien de vidéos, les 3 créateurs qui l'ont porté cette
 * semaine, et ce que ça a fait aux streams et aux ajouts. En production, ces lignes se
 * relèvent (Soundcharts, comptes connectés).
 *
 * Trois artistes ont un scénario écrit à la main (17/09). Les autres en reçoivent un tiré
 * de leurs propres chiffres — le son le plus repris, les vidéos et le rang tendance FR de
 * `tiktokSignal` (les mêmes que « D'où vient la poussée »), leur titre en tête — pour qu'un
 * artiste n'affiche jamais le son d'un autre. Les surfaces simulées évitent le Top 200,
 * déjà relevé et affiché à côté : pas deux rangs contradictoires pour le même classement.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame, Radar, Sparkles, Users } from "lucide-react";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { tiktokSignal, topTracks } from "@/lib/demo/api";
import { daysAgo, isoDay, rngFor } from "@/lib/demo/seed";
import { fmtCompact, fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type PlatformKey = "spotify" | "apple" | "deezer" | "youtube" | "tiktok" | "instagram";

type Placement = { platform: PlatformKey; surface: string; rank: number; delta: number };
type Creator = { handle: string; followers: number; videos: number; views: number };

type Scenario = {
  sound: string;
  brokeOn: string;
  brokeAt: string;
  videos: number;
  videosDelta: number;
  trendRankFr: number | null;
  creators: Creator[];
  streams7: number;
  streams14: number;
  savesSpotify: number;
  savesApple: number;
  playlistAdds: number;
  placements: Placement[];
};

/** Scénarios écrits à la main pour la démo du 19/09 (artistes réels, calibrés sur leur audience). */
const SCENARIOS: Record<string, Scenario> = {
  dadju: {
    sound: "Reine",
    brokeOn: "2026-09-04",
    brokeAt: "19:40",
    videos: 48_200,
    videosDelta: 3_100,
    trendRankFr: 4,
    creators: [
      { handle: "@lea.mkp", followers: 2_100_000, videos: 1, views: 4_800_000 },
      { handle: "@yassine.danse", followers: 860_000, videos: 3, views: 2_900_000 },
      { handle: "@maelys.off", followers: 410_000, videos: 2, views: 1_600_000 },
    ],
    streams7: 18,
    streams14: 31,
    savesSpotify: 12_400,
    savesApple: 3_200,
    playlistAdds: 6,
    placements: [
      { platform: "spotify", surface: "Top 50 France", rank: 23, delta: 9 },
      { platform: "apple", surface: "Top 100 France", rank: 31, delta: 12 },
      { platform: "deezer", surface: "Top France", rank: 27, delta: 6 },
      { platform: "youtube", surface: "Tendances musique FR", rank: 14, delta: 5 },
      { platform: "tiktok", surface: "Sons en tendance FR", rank: 4, delta: 21 },
      { platform: "instagram", surface: "Audios Reels FR", rank: 7, delta: 11 },
    ],
  },
  "nono-la-grinta": {
    sound: "LOVE YOU",
    brokeOn: "2026-09-08",
    brokeAt: "22:15",
    videos: 71_500,
    videosDelta: 5_400,
    trendRankFr: 2,
    creators: [
      { handle: "@inesbcn", followers: 3_400_000, videos: 2, views: 9_100_000 },
      { handle: "@rayane.fit", followers: 1_200_000, videos: 1, views: 3_700_000 },
      { handle: "@la.team.93", followers: 690_000, videos: 4, views: 2_200_000 },
    ],
    streams7: 27,
    streams14: 44,
    savesSpotify: 19_800,
    savesApple: 4_900,
    playlistAdds: 9,
    placements: [
      { platform: "spotify", surface: "Top 50 France", rank: 11, delta: 17 },
      { platform: "apple", surface: "Top 100 France", rank: 19, delta: 22 },
      { platform: "deezer", surface: "Top France", rank: 15, delta: 10 },
      { platform: "youtube", surface: "Tendances musique FR", rank: 8, delta: 9 },
      { platform: "tiktok", surface: "Sons en tendance FR", rank: 2, delta: 38 },
      { platform: "instagram", surface: "Audios Reels FR", rank: 3, delta: 15 },
    ],
  },
  kiko: {
    sound: "Golden Boy",
    brokeOn: "2026-09-12",
    brokeAt: "20:05",
    videos: 640,
    videosDelta: 85,
    trendRankFr: null,
    creators: [
      { handle: "@afrovibes.lome", followers: 92_000, videos: 2, views: 310_000 },
      { handle: "@kossi.dance", followers: 38_000, videos: 1, views: 120_000 },
      { handle: "@togo.trend", followers: 21_000, videos: 3, views: 74_000 },
    ],
    streams7: 9,
    streams14: 14,
    savesSpotify: 260,
    savesApple: 40,
    playlistAdds: 1,
    placements: [
      { platform: "spotify", surface: "Viral 50 Togo", rank: 38, delta: 4 },
      { platform: "apple", surface: "Top 100 Togo", rank: 71, delta: 3 },
      { platform: "deezer", surface: "Top Togo", rank: 44, delta: 2 },
      { platform: "youtube", surface: "Tendances musique TG", rank: 26, delta: 6 },
      { platform: "tiktok", surface: "Sons en tendance TG", rank: 17, delta: 12 },
      { platform: "instagram", surface: "Audios Reels TG", rank: 24, delta: 8 },
    ],
  },
};

/** Les pseudonymes déjà validés pour la démo, redistribués d'un artiste à l'autre. */
const HANDLES = [
  "@lea.mkp",
  "@yassine.danse",
  "@maelys.off",
  "@inesbcn",
  "@rayane.fit",
  "@la.team.93",
  "@kossi.dance",
  "@afrovibes.lome",
  "@togo.trend",
];

/** Scénario tiré des chiffres de l'artiste lui-même (déterministe, seedé par artiste). */
function scenarioFor(artistId: string): Scenario | null {
  if (SCENARIOS[artistId]) return SCENARIOS[artistId];
  const sig = tiktokSignal(artistId);
  const lead = topTracks(artistId, 30, 1)[0];
  const sound = sig?.topSound ?? lead?.title;
  if (!sound) return null;
  const rand = rngFor(`${artistId}:algo-trend`);
  const videos = sig?.videos ?? Math.round(400 + rand() * 3_600);
  const videosDelta = sig?.deltaYesterday ?? Math.round(videos * (0.02 + rand() * 0.06));
  const trendRankFr = sig?.trendingRankFr ?? null;
  const reach = Math.max(15_000, videos * 25);

  const pool = [...HANDLES];
  const creators: Creator[] = [1, 0.45, 0.2].map((share) => {
    const handle = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const followers = Math.round(reach * share * (0.8 + rand() * 0.4));
    return { handle, followers, videos: 1 + Math.floor(rand() * 4), views: Math.round(followers * (1.6 + rand() * 1.6)) };
  });

  const streams7 = 4 + Math.round(rand() * 22);
  const savesSpotify = Math.round(videos * (0.2 + rand() * 0.2));
  const rankFrom = (base: number) => Math.max(1, Math.min(50, Math.round(base)));
  const basis = trendRankFr ?? 20 + Math.round(rand() * 25);
  const placements: Placement[] = [
    { platform: "spotify", surface: "Viral 50 France", rank: rankFrom(basis * 1.6 + rand() * 6), delta: 1 + Math.round(rand() * 14) },
    { platform: "youtube", surface: "Tendances musique FR", rank: rankFrom(basis * 1.2 + rand() * 8), delta: 1 + Math.round(rand() * 9) },
    ...(trendRankFr !== null
      ? [{ platform: "tiktok" as const, surface: "Sons en tendance FR", rank: trendRankFr, delta: 2 + Math.round(rand() * 30) }]
      : []),
    { platform: "instagram", surface: "Audios Reels FR", rank: rankFrom(basis * 1.4 + rand() * 6), delta: 1 + Math.round(rand() * 12) },
  ];

  return {
    sound,
    brokeOn: isoDay(daysAgo(3 + Math.floor(rand() * 18))),
    brokeAt: `${18 + Math.floor(rand() * 5)}:${String(Math.floor(rand() * 12) * 5).padStart(2, "0")}`,
    videos,
    videosDelta,
    trendRankFr,
    creators,
    streams7,
    streams14: streams7 + 5 + Math.round(rand() * 16),
    savesSpotify,
    savesApple: Math.round(savesSpotify * (0.18 + rand() * 0.12)),
    playlistAdds: 1 + Math.floor(rand() * 7),
    placements,
  };
}

function signed(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: "always" }).format(n);
}

const LABEL = "sheet-ink flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase";

/**
 * `artists` : un seul (vue artiste, artiste zoomé), ou le roster — on choisit alors l'artiste
 * en tête de liste (le plus repris sur TikTok), puis n'importe lequel d'un clic.
 */
export function AlgoTrendPanel({ artists, className }: { artists: { id: string; name: string }[]; className?: string }) {
  const t = useTranslations("pulse.algo");
  const locale = useLocale();
  const withScenario = useMemo(
    () => artists.flatMap((a) => {
      const s = scenarioFor(a.id);
      return s ? [{ ...a, s }] : [];
    }),
    [artists],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const current = withScenario.find((a) => a.id === picked) ?? withScenario[0];
  if (!current) return null;
  const { s } = current;

  return (
    <Sheet family="trends" className={className}>
      <SheetHeading action={<ProvenanceBadge provenance="simulated" />}>{t("title")}</SheetHeading>
      <p className="sheet-ink -mt-1 text-[12.5px]">{t("subtitle", { name: current.name })}</p>

      {withScenario.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("pick")}>
          {withScenario.slice(0, 8).map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === current.id}
              onClick={() => setPicked(a.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                a.id === current.id
                  ? "border-foreground/20 bg-background text-foreground font-medium shadow-sm"
                  : "sheet-ink border-transparent hover:border-foreground/15",
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        {/* Le son qui a percé */}
        <div className="lg:col-span-3">
          <p className={LABEL}>
            <Flame className="size-3.5" aria-hidden />
            {t("breakout.kicker")}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-2xl font-semibold tracking-tight">« {s.sound} »</span>
            <span className="sheet-ink text-[12.5px]">
              {t("breakout.since", { date: fmtDate(locale, s.brokeOn, { day: "numeric", month: "long" }), time: s.brokeAt })}
            </span>
          </div>
          <p className="mt-1 text-[13px]">
            {t("breakout.videos", { videos: fmtCompact(locale, s.videos), delta: signed(locale, s.videosDelta) })}
            {" · "}
            {s.trendRankFr !== null ? t("breakout.trend", { rank: s.trendRankFr }) : t("breakout.noTrend")}
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className={LABEL}>
                <Users className="size-3.5" aria-hidden />
                {t("creators.title")}
              </p>
              <ol className="mt-2">
                {s.creators.map((c, i) => (
                  <li key={c.handle} className="border-border/30 grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-2 border-t py-1.5 text-[12.5px]">
                    <span className="sheet-ink text-[11px] tabular-nums">{i + 1}</span>
                    <span className="truncate font-medium">{c.handle}</span>
                    <span className="sheet-ink col-start-2 truncate text-[11px] tabular-nums">
                      {t("creators.line", { followers: fmtCompact(locale, c.followers), videos: c.videos, views: fmtCompact(locale, c.views) })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className={LABEL}>
                <Sparkles className="size-3.5" aria-hidden />
                {t("impact.title")}
              </p>
              <dl className="mt-2 text-[12.5px]">
                {[
                  [t("impact.streams7"), fmtPct(locale, s.streams7, 0)],
                  [t("impact.streams14"), fmtPct(locale, s.streams14, 0)],
                  [t("impact.saves"), fmtInt(locale, s.savesSpotify)],
                  [t("impact.savesApple"), fmtInt(locale, s.savesApple)],
                  [t("impact.playlists"), fmtInt(locale, s.playlistAdds)],
                ].map(([k, v]) => (
                  <div key={k} className="border-border/30 flex items-baseline justify-between gap-3 border-t py-1.5">
                    <dt className="sheet-ink">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
        {/* Position algo par plateforme */}
        <div className="lg:col-span-2 lg:border-l lg:border-border/30 lg:pl-6">
          <p className={LABEL}>
            <Radar className="size-3.5" aria-hidden />
            {t("platforms")}
          </p>
          <ul className="mt-2">
            {s.placements.map((p) => (
              <li key={p.platform} className="border-border/30 flex items-center gap-3 border-t py-1.5 text-[12.5px]">
                <span className="w-24 shrink-0 font-medium">{t(`platform.${p.platform}`)}</span>
                <span className="sheet-ink min-w-0 flex-1 truncate">{p.surface}</span>
                <span className="font-semibold tabular-nums">{t("rank", { rank: p.rank })}</span>
                <span className="text-success w-10 text-right text-[11.5px] tabular-nums">{signed(locale, p.delta)}</span>
              </li>
            ))}
          </ul>
          <p className="sheet-ink mt-1.5 text-[11px]">{t("deltaNote")}</p>
        </div>

      </div>
      <p className="sheet-ink mt-4 text-[11px]">{t("note")}</p>
    </Sheet>
  );
}
