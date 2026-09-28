/**
 * Écriture des registres saisis (concerts, placements, sync, saisies TikTok), côté serveur :
 * clé secrète APRÈS vérification propriétaire/équipe de l'espace de l'artiste.
 * Hors d'un fichier "use server" : ces fonctions ne sont appelées que par les
 * actions de chaque page, jamais directement depuis le navigateur.
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace } from "@/lib/accounts/editor";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";
import { UUID } from "./common";

export type RegisterFormState = { status: "idle" | "ok" | "error"; message?: string };
type Table = "shows" | "placements" | "sync_licenses" | "tiktok_videos" | "tiktok_stats";
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier ces données.";

export async function saveRow(
  table: Table,
  parsed: { ok: true; value: { artist_id: string } & Record<string, unknown> } | { ok: false; error: string },
  rawId: string | undefined,
  path: string,
): Promise<RegisterFormState> {
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = await editableWorkspace(parsed.value.artist_id);
  if (!ctx) return { status: "error", message: DENIED };
  const db = adminDb();
  const id = rawId && UUID.test(rawId) ? rawId : null;
  // .select("id") : une modification qui ne touche aucune ligne est une erreur.
  const { data, error } = id
    ? await db.from(table).update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id")
    : await db.from(table).insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select("id");
  if (error || !data?.length) {
    if (error) console.error(`[${table}/save]`, error);
    return { status: "error", message: error ? "L'enregistrement a échoué." : "Introuvable dans cet espace." };
  }
  revalidatePath(path);
  return { status: "ok" };
}

export async function deleteRow(table: Table, id: string, path: string): Promise<RegisterFormState> {
  if (!UUID.test(id)) return { status: "error", message: "Introuvable." };
  const { data: row } = await (await userDb()).from(table).select("artist_id, workspace_id").eq("id", id).maybeSingle();
  if (!row) return { status: "error", message: "Introuvable." };
  const ctx = await editableWorkspace(row.artist_id);
  if (!ctx || ctx.workspaceId !== row.workspace_id) return { status: "error", message: DENIED };
  const { error } = await adminDb().from(table).delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error(`[${table}/delete]`, error);
    return { status: "error", message: "La suppression a échoué." };
  }
  revalidatePath(path);
  return { status: "ok" };
}

/** FormData → valeurs texte (les champs répétés gardent la dernière valeur ; voir getAll pour les cases multiples). */
export const formValues = (form: FormData) =>
  Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])) as Record<string, string>;
