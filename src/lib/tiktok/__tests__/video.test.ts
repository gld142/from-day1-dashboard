import { describe, expect, it } from "vitest";
import scout from "./fixtures/oembed-scout2015.json";
import { fetchOembed, parseOembed, parseTikTokUrl } from "../video";

describe("parseTikTokUrl", () => {
  it("accepte le lien complet d'une vidéo et le remet à une forme canonique", () => {
    expect(parseTikTokUrl(" https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=fr&is_from_webapp=1 ")).toEqual({
      ok: true,
      value: { handle: "scout2015", videoId: "6718335390845095173", url: "https://www.tiktok.com/@scout2015/video/6718335390845095173" },
    });
    expect(parseTikTokUrl("https://m.tiktok.com/@a.b_c/video/7106594312292453675").ok).toBe(true);
    expect(parseTikTokUrl("tiktok.com/@tiktok/video/7106594312292453675")).toMatchObject({ ok: true, value: { handle: "tiktok" } });
  });

  it("refuse les liens courts avec une consigne, et les autres sites", () => {
    expect(parseTikTokUrl("https://vm.tiktok.com/ZMabc123/")).toEqual({ ok: false, error: expect.stringMatching(/Lien court/) });
    expect(parseTikTokUrl("https://www.tiktok.com/t/ZTabc/")).toEqual({ ok: false, error: expect.stringMatching(/Lien court/) });
    expect(parseTikTokUrl("https://www.youtube.com/watch?v=x")).toEqual({ ok: false, error: expect.stringMatching(/vidéo TikTok/) });
    expect(parseTikTokUrl("https://www.tiktok.com/@scout2015")).toEqual({ ok: false, error: expect.stringMatching(/vidéo TikTok/) });
    expect(parseTikTokUrl("")).toEqual({ ok: false, error: expect.stringMatching(/vidéo TikTok/) });
  });
});

describe("parseOembed — vraie réponse TikTok (@scout2015)", () => {
  it("créateur, titre, son (nom + lien sans ?refer), miniature et son expiration", () => {
    const info = parseOembed(scout);
    expect(info.author_name).toBe("Scout, Suki & Stella");
    expect(info.author_handle).toBe("scout2015");
    expect(info.title).toMatch(/^Scramble up ur name/);
    expect(info.sound_title).toBe("original sound - tiff");
    expect(info.sound_url).toBe("https://www.tiktok.com/music/original-sound-6689804660171082501");
    expect(info.thumbnail_url).toMatch(/^https:\/\/p16-common-sign\.tiktokcdn-eu\.com\//);
    const expires = Number(/x-expires=(\d+)/.exec(scout.thumbnail_url)![1]);
    expect(info.thumbnail_expires_at).toBe(new Date(expires * 1000).toISOString());
  });

  it("décode les entités HTML du nom du son", () => {
    const html = '<a target="_blank" title="♬ Tom &amp; Jerry &#39;live&#39;" href="https://www.tiktok.com/music/tom-jerry-123456789?refer=embed">♬ Tom &amp; Jerry &#39;live&#39;</a>';
    expect(parseOembed({ ...scout, html })).toMatchObject({ sound_title: "Tom & Jerry 'live'", sound_url: "https://www.tiktok.com/music/tom-jerry-123456789" });
  });

  it("sans son dans le html : champs vides, pas d'erreur", () => {
    expect(parseOembed({ ...scout, html: "<blockquote></blockquote>" })).toMatchObject({ sound_title: null, sound_url: null });
  });

  it("refuse une réponse qui n'est pas une fiche de vidéo", () => {
    expect(() => parseOembed({ message: "Something went wrong", code: 400 })).toThrow(/format/);
  });
});

describe("fetchOembed", () => {
  it("400 de TikTok = vidéo introuvable (supprimée ou privée), sans réessayer", async () => {
    let calls = 0;
    const r = await fetchOembed("https://www.tiktok.com/@x/video/1111111111111111111", {
      fetchImpl: async () => {
        calls++;
        return new Response('{"message":"Something went wrong","code":400}', { status: 400 });
      },
    });
    expect(r).toBe("gone");
    expect(calls).toBe(1);
  });

  it("demande la fiche officielle avec le lien encodé", async () => {
    let asked = "";
    const r = await fetchOembed("https://www.tiktok.com/@scout2015/video/6718335390845095173", {
      fetchImpl: async (u) => {
        asked = String(u);
        return new Response(JSON.stringify(scout), { status: 200 });
      },
    });
    expect(asked).toBe("https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40scout2015%2Fvideo%2F6718335390845095173");
    expect(r).toMatchObject({ author_handle: "scout2015" });
  });
});
