"use server";

/**
 * Contrats du client : écriture côté serveur (clé secrète) APRÈS vérification,
 * avec la session de la personne (RLS), qu'elle est propriétaire ou membre de
 * l'équipe de l'espace de cet artiste. L'artiste invité lit, n'écrit pas.
 */
import { revalidatePath } from "next/cache";
import { editableWorkspace } from "@/lib/accounts/editor";
import { parseContract } from "@/lib/contracts/contract";
import { adminDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";

export type ContractFormState = { status: "idle" | "ok" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = "Seuls le propriétaire et l'équipe de l'espace peuvent modifier les contrats.";

export async function saveContract(_: ContractFormState, form: FormData): Promise<ContractFormState> {
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const parsed = parseContract(raw);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const ctx = await editableWorkspace(parsed.value.artist_id);
  if (!ctx) return { status: "error", message: DENIED };

  const db = adminDb();
  const id = raw.id && UUID.test(raw.id) ? raw.id : null;
  // .select("id") : une modification qui ne touche AUCUNE ligne (élément d'un
  // autre espace, ou supprimé entre-temps) est une erreur, pas un « enregistré ».
  const { data: written, error } = id
    ? await db.from("contracts").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id")
    : await db.from("contracts").insert({ ...parsed.value, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select("id");
  if (error || !written?.length) {
    if (error) console.error("[contracts/save]", error);
    return { status: "error", message: error ? "Le contrat n'a pas pu être enregistré." : "Le contrat est introuvable dans cet espace." };
  }
  revalidatePath("/contracts");
  return { status: "ok" };
}

export async function deleteContract(_: ContractFormState, form: FormData): Promise<ContractFormState> {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { status: "error", message: "Contrat introuvable." };
  // Le contrat, lu avec la session : s'il n'est pas visible, il n'existe pas.
  const { data: contract } = await (await userDb()).from("contracts").select("artist_id, workspace_id").eq("id", id).maybeSingle();
  if (!contract) return { status: "error", message: "Contrat introuvable." };
  const ctx = await editableWorkspace(contract.artist_id);
  if (!ctx || ctx.workspaceId !== contract.workspace_id) return { status: "error", message: DENIED };
  const { error } = await adminDb().from("contracts").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[contracts/delete]", error);
    return { status: "error", message: "Le contrat n'a pas pu être supprimé." };
  }
  revalidatePath("/contracts");
  return { status: "ok" };
}
