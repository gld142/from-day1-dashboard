"use server";

/**
 * Splits du client : écriture côté serveur (clé secrète) APRÈS vérification
 * (propriétaire ou équipe de l'espace de cet artiste). L'artiste invité lit.
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace } from "@/lib/accounts/editor";
import { parseSplit } from "@/lib/splits/split";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";

export type SplitFormState = { status: "idle" | "ok" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier les splits.";

export async function saveSplit(_: SplitFormState, form: FormData): Promise<SplitFormState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const parsed = parseSplit(raw);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = await editableWorkspace(parsed.value.artist_id);
  if (!ctx) return { status: "error", message: DENIED };

  const db = adminDb();
  const id = raw.id && UUID.test(raw.id) ? raw.id : null;
  // .select("id") : une modification qui ne touche AUCUNE ligne (élément d'un
  // autre espace, ou supprimé entre-temps) est une erreur, pas un « enregistré ».
  const { data: written, error } = id
    ? await db.from("splits").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id")
    : await db.from("splits").insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select("id");
  if (error || !written?.length) {
    if (error) console.error("[splits/save]", error);
    return { status: "error", message: error ? "Le split n'a pas pu être enregistré." : "Le split est introuvable dans cet espace." };
  }
  revalidatePath("/splits");
  return { status: "ok" };
}

export async function deleteSplit(_: SplitFormState, form: FormData): Promise<SplitFormState> {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { status: "error", message: "Split introuvable." };
  const { data: split } = await (await userDb()).from("splits").select("artist_id, workspace_id").eq("id", id).maybeSingle();
  if (!split) return { status: "error", message: "Split introuvable." };
  const ctx = await editableWorkspace(split.artist_id);
  if (!ctx || ctx.workspaceId !== split.workspace_id) return { status: "error", message: DENIED };
  const { error } = await adminDb().from("splits").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[splits/delete]", error);
    return { status: "error", message: "Le split n'a pas pu être supprimé." };
  }
  revalidatePath("/splits");
  return { status: "ok" };
}
