"use server";

import { saveWikiLink } from "@/lib/attention/persist";
import { revalidatePath } from "next/cache";
import { editableWorkspaceById } from "@/lib/accounts/editor";
import { UUID, fail, guard, text } from "@/lib/registers/common";
import { formValues, type RegisterFormState } from "@/lib/registers/persist";
import { adminDb } from "@/lib/supabase/admin";

const PATH = "/ar-watch";
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier la liste.";

/** Un artiste à suivre (A&R) : donnée de la STRUCTURE, sans artiste du roster. */
export async function addWatch(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  const parsed = guard(() => {
    if (!UUID.test(raw.workspace_id ?? "")) fail("Espace introuvable.");
    return { artist_name: text(raw.artist_name, 160, "Indique le nom de l'artiste.")!, notes: text(raw.notes, 2000) };
  });
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = await editableWorkspaceById(raw.workspace_id!);
  if (!ctx) return { status: "error", message: DENIED };
  const { error } = await adminDb().from("ar_watchlist").insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Cet artiste est déjà dans ta liste." };
    console.error("[ar_watchlist/insert]", error);
    return { status: "error", message: "L'enregistrement a échoué." };
  }
  revalidatePath(PATH);
  return { status: "ok" };
}

export async function removeWatch(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  if (!UUID.test(raw.id ?? "") || !UUID.test(raw.workspace_id ?? "")) return { status: "error", message: "Introuvable." };
  const ctx = await editableWorkspaceById(raw.workspace_id!);
  if (!ctx) return { status: "error", message: DENIED };
  const { data, error } = await adminDb().from("ar_watchlist").delete().eq("id", raw.id!).eq("workspace_id", ctx.workspaceId).select("id");
  if (error || !data?.length) return { status: "error", message: error ? "La suppression a échoué." : "Introuvable dans cet espace." };
  revalidatePath(PATH);
  return { status: "ok" };
}

/** Lien Wikipédia d'un artiste suivi, corrigé par l'équipe (ou « aucune page »). */
export async function setWatchWiki(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  return saveWikiLink({ watch_id: raw.watch_id, url: raw.url, none: raw.none }, PATH);
}
