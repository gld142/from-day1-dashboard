import { describe, expect, it } from "vitest";
import { tiktokRefreshCollector, type TikTokVideoStore } from "../tiktok-refresh";
import type { OembedInfo } from "@/lib/tiktok/video";

const info = (handle: string): OembedInfo => ({
  author_name: handle.toUpperCase(),
  author_handle: handle,
  title: "t",
  sound_title: "son",
  sound_url: "https://www.tiktok.com/music/son-1",
  thumbnail_url: "https://img",
  thumbnail_expires_at: "2026-10-01T18:00:00.000Z",
});

function store(videos: { id: string; video_url: string }[]) {
  const updates: Record<string, Record<string, unknown>> = {};
  const s: TikTokVideoStore = {
    list: async () => videos,
    update: async (id, patch) => {
      updates[id] = patch;
    },
  };
  return { s, updates };
}

describe("rafraîchissement des vidéos TikTok collées", () => {
  it("met à jour la fiche, marque les vidéos disparues, compte les échecs réseau à part", async () => {
    const { s, updates } = store([
      { id: "1", video_url: "https://www.tiktok.com/@a/video/111111" },
      { id: "2", video_url: "https://www.tiktok.com/@b/video/222222" },
      { id: "3", video_url: "https://www.tiktok.com/@c/video/333333" },
    ]);
    const r = await tiktokRefreshCollector(s, {
      fetchOembed: async (url) => {
        if (url.includes("@b/")) return "gone";
        if (url.includes("@c/")) throw new Error("délai dépassé");
        return info("a");
      },
      now: () => new Date("2026-09-29T04:00:00Z"),
    }).run();
    expect(r).toEqual({ rows: 2, partial: true, detail: "1 vidéo non vérifiée (délai dépassé)" });
    expect(updates["1"]).toMatchObject({ status: "ok", author_handle: "a", checked_at: "2026-09-29T04:00:00.000Z" });
    expect(updates["2"]).toEqual({ status: "gone", checked_at: "2026-09-29T04:00:00.000Z" });
    expect(updates["3"]).toBeUndefined();
  });

  it("aucune vidéo collée : passage ok à 0 ligne, dit comme tel", async () => {
    const { s } = store([]);
    expect(await tiktokRefreshCollector(s, { fetchOembed: async () => info("x") }).run()).toEqual({ rows: 0, detail: "aucune vidéo collée" });
  });

  it("toutes en échec réseau : erreur, pas un « ok »", async () => {
    const { s } = store([{ id: "1", video_url: "u" }]);
    await expect(tiktokRefreshCollector(s, { fetchOembed: async () => { throw new Error("HTTP 503"); } }).run()).rejects.toThrow(/aucune vidéo vérifiée/);
  });
});
