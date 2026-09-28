/**
 * Chaque nuit, Day 1 relit la fiche officielle (oEmbed) des vidéos TikTok collées
 * par les équipes : la miniature est une adresse signée qui expire (~2 jours,
 * mesuré le 28/09), et une vidéo supprimée ou passée en privé doit être signalée.
 * Les vues ne sont PAS dans la fiche : elles restent saisies à la main.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOembed as officialOembed, type OembedInfo } from "@/lib/tiktok/video";
import type { Collector } from "./run";

export type TikTokVideoStore = {
  list(): Promise<{ id: string; video_url: string }[]>;
  update(id: string, patch: Record<string, unknown>): Promise<void>;
};

/** Au plus 500 vidéos par nuit, les moins récemment vérifiées d'abord ; 4 à la fois. */
const LIMIT = 500;
const PARALLEL = 4;

export function supabaseTikTokStore(db: SupabaseClient): TikTokVideoStore {
  return {
    list: async () => {
      const { data, error } = await db.from("tiktok_videos").select("id, video_url").order("checked_at", { ascending: true }).limit(LIMIT);
      if (error) throw new Error(`Supabase : ${error.message}`);
      return data ?? [];
    },
    update: async (id, patch) => {
      const { error } = await db.from("tiktok_videos").update(patch).eq("id", id);
      if (error) throw new Error(`Supabase : ${error.message}`);
    },
  };
}

export function tiktokRefreshCollector(
  store: TikTokVideoStore,
  deps: { fetchOembed?: (url: string) => Promise<OembedInfo | "gone">; now?: () => Date } = {},
): Collector {
  const fetchOembed = deps.fetchOembed ?? ((url: string) => officialOembed(url));
  return {
    source: "tiktok_oembed",
    run: async () => {
      const videos = await store.list();
      if (!videos.length) return { rows: 0, detail: "aucune vidéo collée" };
      const checked_at = (deps.now ?? (() => new Date()))().toISOString();
      let done = 0;
      const failures: string[] = [];
      const queue = [...videos];
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
          for (let v = queue.shift(); v; v = queue.shift()) {
            try {
              const r = await fetchOembed(v.video_url);
              await store.update(v.id, r === "gone" ? { status: "gone", checked_at } : { ...r, status: "ok", checked_at });
              done++;
            } catch (e) {
              failures.push(e instanceof Error ? e.message : String(e));
            }
          }
        }),
      );
      if (!done) throw new Error(`TikTok : aucune vidéo vérifiée — ${failures[0] ?? ""}`);
      if (!failures.length) return { rows: done };
      const n = failures.length;
      return { rows: done, partial: true, detail: `${n} vidéo${n > 1 ? "s" : ""} non vérifiée${n > 1 ? "s" : ""} (${failures[0]})` };
    },
  };
}
