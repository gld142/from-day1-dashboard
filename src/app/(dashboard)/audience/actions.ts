"use server";

import { revalidatePath } from "next/cache";
import { editableWorkspace } from "@/lib/accounts/editor";
import { parisDate } from "@/lib/collect/dates";
import { deleteRow, formValues, saveRow, type RegisterFormState } from "@/lib/registers/persist";
import { UUID } from "@/lib/registers/common";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";
import { parseTikTokStats, parseVideoInput, parseViews } from "@/lib/tiktok/forms";
import { fetchOembed } from "@/lib/tiktok/video";

const PATH = "/audience";
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier ces données.";
const today = () => parisDate(new Date());

/** Une vidéo qui utilise le son : Day 1 lit sa fiche officielle TikTok avant de l'enregistrer. */
export async function addTikTokVideo(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const parsed = parseVideoInput(formValues(form), today());
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const { artist_id, ref, views, views_on, notes } = parsed.value;
  const ctx = await editableWorkspace(artist_id);
  if (!ctx) return { status: "error", message: DENIED };
  let info: Awaited<ReturnType<typeof fetchOembed>>;
  try {
    info = await fetchOembed(ref.url);
  } catch (e) {
    console.error("[tiktok/oembed]", e);
    return { status: "error", message: "TikTok ne répond pas pour l'instant. Réessaie dans un moment." };
  }
  if (info === "gone") return { status: "error", message: "TikTok ne trouve pas cette vidéo : elle est supprimée, privée, ou le lien est incomplet." };
  const { error } = await adminDb()
    .from("tiktok_videos")
    .insert({ workspace_id: ctx.workspaceId, artist_id, created_by: ctx.userId, video_id: ref.videoId, video_url: ref.url, ...info, status: "ok", checked_at: new Date().toISOString(), views, views_on, notes });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Cette vidéo est déjà dans la liste." };
    console.error("[tiktok_videos/insert]", error);
    return { status: "error", message: "L'enregistrement a échoué." };
  }
  revalidatePath(PATH);
  return { status: "ok" };
}

/** Vues recopiées depuis TikTok, datées. */
export async function updateTikTokViews(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  if (!UUID.test(raw.id ?? "")) return { status: "error", message: "Introuvable." };
  const parsed = parseViews(raw, today());
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const { data: row } = await (await userDb()).from("tiktok_videos").select("artist_id").eq("id", raw.id).maybeSingle();
  if (!row) return { status: "error", message: "Introuvable." };
  return saveRow("tiktok_videos", { ok: true, value: { artist_id: row.artist_id, ...parsed.value } }, raw.id, PATH);
}

export async function deleteTikTokVideo(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  return deleteRow("tiktok_videos", String(form.get("id") ?? ""), PATH);
}

/** Chiffres recopiés depuis TikTok for Artists : réservés à l'espace du client. */
export async function saveTikTokStats(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  return saveRow("tiktok_stats", parseTikTokStats(raw, today()), raw.id, PATH);
}

export async function deleteTikTokStats(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  return deleteRow("tiktok_stats", String(form.get("id") ?? ""), PATH);
}
