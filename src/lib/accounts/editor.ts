import { redirect } from "next/navigation";
import { userDb } from "@/lib/supabase/server";

/**
 * L'espace de cet artiste, si la personne connectée peut y MODIFIER les
 * données saisies (contrats, splits…) : propriétaire ou équipe. L'artiste
 * invité lit, n'écrit pas. Tout est lu avec SA session (RLS) : un artiste
 * qu'elle ne voit pas n'existe pas pour elle.
 *
 * Volontairement HORS d'un fichier "use server" : exportée d'un tel fichier,
 * cette fonction deviendrait une action appelable depuis le navigateur.
 */
export async function editableWorkspace(artistId: string): Promise<{ userId: string; workspaceId: string } | null> {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/connexion");
  const { data: artist } = await db.from("artists").select("workspace_id").eq("id", artistId).maybeSingle();
  if (!artist) return null;
  const { data: me } = await db
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", artist.workspace_id)
    .eq("user_id", data.user.id)
    .maybeSingle();
  return me && (me.role === "owner" || me.role === "member") ? { userId: data.user.id, workspaceId: artist.workspace_id as string } : null;
}
