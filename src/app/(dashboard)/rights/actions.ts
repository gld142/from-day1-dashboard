"use server";

/**
 * Versements de droits du client : écriture côté serveur (clé secrète) APRÈS
 * vérification (propriétaire ou équipe de l'espace de cet artiste).
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace } from "@/lib/accounts/editor";
import { parsePayment } from "@/lib/rights/payment";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";

export type RightsFormState = { status: "idle" | "ok" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier les droits.";

export async function saveRightsPayment(_: RightsFormState, form: FormData): Promise<RightsFormState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const parsed = parsePayment(raw, new Date().toISOString().slice(0, 10));
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = await editableWorkspace(parsed.value.artist_id);
  if (!ctx) return { status: "error", message: DENIED };

  const db = adminDb();
  const id = raw.id && UUID.test(raw.id) ? raw.id : null;
  // .select("id") : une modification qui ne touche aucune ligne est une erreur.
  const { data: written, error } = id
    ? await db.from("rights_payments").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id")
    : await db.from("rights_payments").insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select("id");
  if (error || !written?.length) {
    if (error) console.error("[rights/save]", error);
    return { status: "error", message: error ? "Le versement n'a pas pu être enregistré." : "Le versement est introuvable dans cet espace." };
  }
  revalidatePath("/rights");
  return { status: "ok" };
}

export async function deleteRightsPayment(_: RightsFormState, form: FormData): Promise<RightsFormState> {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { status: "error", message: "Versement introuvable." };
  const { data: row } = await (await userDb()).from("rights_payments").select("artist_id, workspace_id").eq("id", id).maybeSingle();
  if (!row) return { status: "error", message: "Versement introuvable." };
  const ctx = await editableWorkspace(row.artist_id);
  if (!ctx || ctx.workspaceId !== row.workspace_id) return { status: "error", message: DENIED };
  const { error } = await adminDb().from("rights_payments").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[rights/delete]", error);
    return { status: "error", message: "Le versement n'a pas pu être supprimé." };
  }
  revalidatePath("/rights");
  return { status: "ok" };
}
