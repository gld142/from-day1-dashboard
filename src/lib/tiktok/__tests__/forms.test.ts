import { describe, expect, it } from "vitest";
import { parseTikTokStats, parseVideoInput, parseViews, statDelta, statPairs, type TikTokStat } from "../forms";

const A = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const TODAY = "2026-09-29";
const URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=fr";

describe("vidéo collée", () => {
  it("lien + vues facultatives ; les vues sont datées (du jour si la date manque)", () => {
    expect(parseVideoInput({ artist_id: A, video_url: URL, views: "1 250 000" }, TODAY)).toEqual({
      ok: true,
      value: { artist_id: A, ref: { handle: "scout2015", videoId: "6718335390845095173", url: "https://www.tiktok.com/@scout2015/video/6718335390845095173" }, views: 1250000, views_on: TODAY, notes: null },
    });
    expect(parseVideoInput({ artist_id: A, video_url: URL }, TODAY)).toMatchObject({ ok: true, value: { views: null, views_on: null } });
    expect(parseVideoInput({ artist_id: A, video_url: URL, views: "10", views_on: "2026-09-20" }, TODAY)).toMatchObject({ ok: true, value: { views_on: "2026-09-20" } });
  });
  it("refuse un lien court, un artiste manquant, des vues négatives ou datées du futur", () => {
    expect(parseVideoInput({ artist_id: A, video_url: "https://vm.tiktok.com/ZMabc/" }, TODAY)).toEqual({ ok: false, error: expect.stringMatching(/Lien court/) });
    expect(parseVideoInput({ artist_id: "", video_url: URL }, TODAY)).toEqual({ ok: false, error: "Choisis l'artiste dont c'est le son." });
    expect(parseVideoInput({ artist_id: A, video_url: URL, views: "-3" }, TODAY).ok).toBe(false);
    expect(parseVideoInput({ artist_id: A, video_url: URL, views: "3", views_on: "2026-10-01" }, TODAY)).toEqual({ ok: false, error: "La date des vues est dans le futur." });
  });
  it("mise à jour des vues seules", () => {
    expect(parseViews({ views: "2 000", views_on: "" }, TODAY)).toEqual({ ok: true, value: { views: 2000, views_on: TODAY } });
    expect(parseViews({ views: "" }, TODAY)).toEqual({ ok: true, value: { views: null, views_on: null } });
  });
});

describe("chiffres TikTok for Artists saisis", () => {
  it("compte : date obligatoire, nombres à la française, période exigée pour les vues", () => {
    expect(parseTikTokStats({ artist_id: A, as_of: "2026-09-28", followers: "12 400", video_views: "830 000", period_days: "28" }, TODAY)).toEqual({
      ok: true,
      value: { artist_id: A, as_of: "2026-09-28", scope: "account", track_title: null, period_days: 28, followers: 12400, likes: null, video_views: 830000, profile_views: null, track_videos: null, track_views: null, notes: null },
    });
    expect(parseTikTokStats({ artist_id: A, as_of: "", followers: "1" }, TODAY)).toEqual({ ok: false, error: "Indique la date du relevé." });
    expect(parseTikTokStats({ artist_id: A, as_of: "2026-09-28", video_views: "5" }, TODAY)).toEqual({ ok: false, error: expect.stringMatching(/période/) });
    expect(parseTikTokStats({ artist_id: A, as_of: "2026-09-28" }, TODAY)).toEqual({ ok: false, error: expect.stringMatching(/au moins un chiffre/) });
    expect(parseTikTokStats({ artist_id: A, as_of: "2026-09-30", followers: "1" }, TODAY)).toEqual({ ok: false, error: "La date du relevé est dans le futur." });
    expect(parseTikTokStats({ artist_id: A, as_of: "2026-09-28", followers: "1", period_days: "14" }, TODAY).ok).toBe(false);
  });
  it("titre : les champs du compte sont ignorés, ceux du titre gardés", () => {
    const r = parseTikTokStats({ artist_id: A, as_of: "2026-09-28", track_title: " Mélo Décalé ", track_videos: "4 100", track_views: "9 000 000", followers: "99", period_days: "7" }, TODAY);
    expect(r).toMatchObject({ ok: true, value: { scope: "track", track_title: "Mélo Décalé", track_videos: 4100, track_views: 9000000, followers: null, period_days: 7 } });
  });
});

describe("écarts entre deux relevés", () => {
  const stat = (as_of: string, over: Partial<TikTokStat> = {}): TikTokStat => ({
    id: as_of + (over.track_title ?? ""), updated_at: as_of, artist_id: A, as_of, scope: over.track_title ? "track" : "account", track_title: null, period_days: 28,
    followers: null, likes: null, video_views: null, profile_views: null, track_videos: null, track_views: null, notes: null, ...over,
  });
  it("regroupe par compte et par titre (casse et accents ignorés), du plus récent au plus ancien", () => {
    const p = statPairs([
      stat("2026-09-01", { followers: 10000 }),
      stat("2026-09-28", { followers: 12400 }),
      stat("2026-09-28", { track_title: "Mélo Décalé", track_videos: 4100 }),
      stat("2026-09-14", { track_title: "melo decale", track_videos: 3000 }),
    ]);
    expect(p.account?.latest.as_of).toBe("2026-09-28");
    expect(p.account?.previous?.as_of).toBe("2026-09-01");
    expect(p.tracks).toHaveLength(1);
    expect(p.tracks[0].latest.track_videos).toBe(4100);
    expect(p.tracks[0].previous?.track_videos).toBe(3000);
  });
  it("abonnés : écart toujours ; vues : seulement sur la même période", () => {
    const latest = stat("2026-09-28", { followers: 12400, video_views: 900, period_days: 28 });
    expect(statDelta(latest, stat("2026-09-01", { followers: 10000, video_views: 500, period_days: 28 }), "followers")).toBe(2400);
    expect(statDelta(latest, stat("2026-09-01", { followers: 10000, video_views: 500, period_days: 28 }), "video_views")).toBe(400);
    expect(statDelta(latest, stat("2026-09-01", { video_views: 50, period_days: 7 }), "video_views")).toBeNull();
    expect(statDelta(latest, null, "followers")).toBeNull();
  });
});
