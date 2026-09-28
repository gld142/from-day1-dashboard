/**
 * Correction du lien Wikipédia d'un artiste (roster ou liste A&R) par l'équipe, côté
 * serveur : droits vérifiés, lien enregistré (« manual » ou « none »), puis vues des 120
 * derniers jours relevées tout de suite pour ne pas attendre la nuit.
 * Hors d'un fichier "use server" : appelé par les actions des pages seulement.
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace, editableWorkspaceById } from "@/lib/accounts/editor";
import { parisDate } from "@/lib/collect/dates";
import { FetchError, fetchWithRetry } from "@/lib/collect/fetch";
import { UUID } from "@/lib/registers/common";
import type { RegisterFormState } from "@/lib/registers/persist";
import { adminDb } from "@/lib/supabase/admin";
import { pageviewsUrl, parsePageviews, parseWikipediaUrl } from "./wikipedia";

const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier ce lien.";

export async function saveWikiLink(raw: Record<string, string | undefined>, path: string): Promise<RegisterFormState> {
  const kind = raw.artist_id ? "artist" : "watch";
  const subject = kind === "artist" ? raw.artist_id : raw.watch_id;
  if (!subject || !UUID.test(subject)) return { status: "error", message: "Introuvable." };
  const none = raw.none === "1";
  const ref = none ? null : parseWikipediaUrl(raw.url ?? "");
  if (!none && !ref) return { status: "error", message: "Colle le lien d'une page Wikipédia en français ou en anglais (fr.wikipedia.org/wiki/…)." };

  let workspaceId: string | null = null;
  if (kind === "artist") workspaceId = (await editableWorkspace(subject))?.workspaceId ?? null;
  else {
    const { data: w } = await adminDb().from("ar_watchlist").select("workspace_id").eq("id", subject).maybeSingle();
    workspaceId = w ? ((await editableWorkspaceById(w.workspace_id as string))?.workspaceId ?? null) : null;
  }
  if (!workspaceId) return { status: "error", message: DENIED };

  const db = adminDb();
  const row = {
    workspace_id: workspaceId,
    artist_id: kind === "artist" ? subject : null,
    watch_id: kind === "watch" ? subject : null,
    qid: null,
    project: ref?.project ?? null,
    article: ref?.article ?? null,
    method: none ? "none" : "manual",
    updated_at: new Date().toISOString(),
    checked_at: new Date().toISOString(),
  };
  const { error } = await db.from("wiki_links").upsert(row, { onConflict: kind === "artist" ? "artist_id" : "watch_id" });
  if (error) {
    console.error("[wiki_links/save]", error);
    return { status: "error", message: "L'enregistrement a échoué." };
  }
  if (ref) {
    const yesterday = new Date(Date.now() - 86_400_000);
    const to = parisDate(yesterday);
    const from = parisDate(new Date(yesterday.getTime() - 119 * 86_400_000));
    try {
      const series = parsePageviews(await (await fetchWithRetry(pageviewsUrl(ref, from, to), { tries: 2 })).json());
      if (series.length) await db.from("wiki_pageviews").upsert(series.map((s) => ({ project: ref.project, article: ref.article, day: s.day, views: s.views })), { onConflict: "project,article,day" });
    } catch (e) {
      if (e instanceof FetchError && e.status === 404) return { status: "error", message: "Wikipédia ne connaît pas cette page (vérifie le lien)." };
      console.error("[wiki_pageviews/manual]", e); // la collecte de nuit rattrapera
    }
  }
  revalidatePath(path);
  return { status: "ok" };
}
