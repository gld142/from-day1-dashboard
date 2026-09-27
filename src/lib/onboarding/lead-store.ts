import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "./lead";
import { toRow } from "./lead-row";

/**
 * Leads du parcours d'achat, dans Supabase (table public.leads).
 * Écriture côté serveur avec la clé secrète : la table est fermée à l'API
 * publique (RLS sans règle), même avec la clé publishable.
 */
let client: SupabaseClient | undefined;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

type Saved = Pick<Lead, "id" | "stage">;

/** Complète la lead `id` ; sans id (ou id inconnu), en crée une nouvelle. */
export async function upsertLead(id: string | undefined, patch: Partial<Lead>): Promise<Saved> {
  const row = toRow(patch);
  if (id) {
    // Rien de valable à écrire (champs refusés par sanitize) : on renvoie la lead telle quelle.
    const query = Object.keys(row).length
      ? db().from("leads").update(row).eq("id", id)
      : db().from("leads").select().eq("id", id);
    const { data, error } = await query.select("id, stage").maybeSingle();
    if (error) throw error;
    if (data) return data as Saved;
  }
  const { data, error } = await db().from("leads").insert(row).select("id, stage").single();
  if (error) throw error;
  return data as Saved;
}
