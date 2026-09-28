"use server";

/**
 * Dépenses du client : écriture côté serveur (clé secrète) APRÈS vérification
 * (propriétaire ou équipe). Une dépense de la structure (sans artiste) se
 * vérifie sur l'espace lui-même.
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace, editableWorkspaceById } from "@/lib/accounts/editor";
import { parseExpense } from "@/lib/finances/pnl";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";

export type ExpenseFormState = { status: "idle" | "ok" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier les dépenses.";

export async function saveExpense(_: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const parsed = parseExpense(raw, new Date().toISOString().slice(0, 10));
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = parsed.value.artist_id
    ? await editableWorkspace(parsed.value.artist_id)
    : UUID.test(raw.workspace_id ?? "")
      ? await editableWorkspaceById(raw.workspace_id)
      : null;
  if (!ctx) return { status: "error", message: DENIED };

  const db = adminDb();
  const id = raw.id && UUID.test(raw.id) ? raw.id : null;
  // .select("id") : une modification qui ne touche aucune ligne est une erreur.
  const { data: written, error } = id
    ? await db.from("expenses").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id")
    : await db.from("expenses").insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select("id");
  if (error || !written?.length) {
    if (error) console.error("[finances/save]", error);
    return { status: "error", message: error ? "La dépense n'a pas pu être enregistrée." : "La dépense est introuvable dans cet espace." };
  }
  revalidatePath("/finances");
  return { status: "ok" };
}

export async function deleteExpense(_: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { status: "error", message: "Dépense introuvable." };
  const { data: row } = await (await userDb()).from("expenses").select("artist_id, workspace_id").eq("id", id).maybeSingle();
  if (!row) return { status: "error", message: "Dépense introuvable." };
  const ctx = row.artist_id ? await editableWorkspace(row.artist_id) : await editableWorkspaceById(row.workspace_id);
  if (!ctx || ctx.workspaceId !== row.workspace_id) return { status: "error", message: DENIED };
  const { error } = await adminDb().from("expenses").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[finances/delete]", error);
    return { status: "error", message: "La dépense n'a pas pu être supprimée." };
  }
  revalidatePath("/finances");
  return { status: "ok" };
}
