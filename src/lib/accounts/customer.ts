import { cookies } from "next/headers";
import type { CustomerInfo } from "@/lib/customer-mode";
import { userDb } from "@/lib/supabase/server";
import type { RosterArtist, RosterStatement } from "@/lib/userdata/roster";
import type { UserData } from "@/lib/userdata/store";

/** Artiste ouvert dans le dashboard (choisi dans /espace). */
export const ARTIST_COOKIE = "d1_artist";

/** Abonnements qui donnent accès au dashboard (un retard de paiement ne coupe pas tout de suite). */
const OPEN = new Set(["active", "trialing", "past_due"]);

export type CustomerView =
  | { kind: "anonymous" }
  | { kind: "blocked"; reason: "no-artist" | "subscription" }
  | { kind: "customer"; info: CustomerInfo; data: UserData | null };

/**
 * Qui regarde le dashboard ? Tout est lu avec la session de la personne (RLS) :
 * elle ne peut ouvrir qu'un artiste qu'elle a le droit de voir.
 */
export async function customerView(): Promise<CustomerView> {
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { kind: "anonymous" };

  const { data: artists } = await db.from("artists").select("id, name, workspace_id").order("created_at");
  if (!artists?.length) return { kind: "blocked", reason: "no-artist" };
  const wanted = (await cookies()).get(ARTIST_COOKIE)?.value;
  const artist = artists.find((a) => a.id === wanted) ?? artists[0];

  const [{ data: ws }, { data: me }, { data: imp }] = await Promise.all([
    db.from("workspaces").select("name, subscription_status").eq("id", artist.workspace_id).single(),
    db.from("workspace_members").select("role").eq("workspace_id", artist.workspace_id).eq("user_id", auth.user.id).single(),
    db.from("artist_imports").select("data").eq("artist_id", artist.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!ws || !me || !OPEN.has(ws.subscription_status)) return { kind: "blocked", reason: "subscription" };
  return {
    kind: "customer",
    info: { userId: auth.user.id, workspaceId: artist.workspace_id, email: auth.user.email ?? "", workspaceName: ws.name, role: me.role, artistId: artist.id, artistName: artist.name },
    data: (imp?.data as UserData | undefined) ?? null,
  };
}

/**
 * Le roster de l'espace : ses artistes et, pour chacun, son DERNIER relevé —
 * seulement les champs que le roster lit (pas les titres ni les pays). Lu avec
 * la session de la personne : la RLS ne rend que ce qu'elle a le droit de voir.
 */
export async function customerRoster(workspaceId: string): Promise<RosterArtist[]> {
  const db = await userDb();
  const [{ data: artists, error: artistsError }, { data: imports, error: importsError }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db
      .from("artist_imports")
      .select("artist_id, months:data->months, revenueByMonth:data->revenueByMonth, streamsByMonth:data->streamsByMonth, importedAt:data->>importedAt, format:data->>format")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  if (artistsError) throw artistsError;
  if (importsError) throw importsError;
  const latest = new Map<string, RosterStatement>();
  for (const { artist_id, ...statement } of imports ?? []) {
    if (!latest.has(artist_id)) latest.set(artist_id, statement as RosterStatement);
  }
  return (artists ?? []).map((a) => ({ id: a.id, name: a.name, statement: latest.get(a.id) ?? null }));
}
