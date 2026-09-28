import { cookies } from "next/headers";
import type { CustomerInfo } from "@/lib/customer-mode";
import { userDb } from "@/lib/supabase/server";
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
