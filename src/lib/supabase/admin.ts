import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase « serveur de confiance » (clé secrète) : contourne la RLS.
 * Réservé aux routes serveur, APRÈS vérification de qui agit. Jamais importé
 * côté navigateur (la clé n'y existe pas de toute façon : pas de NEXT_PUBLIC_).
 */
let client: SupabaseClient | undefined;

export function adminDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
