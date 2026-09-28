import { cookies } from "next/headers";
import type { CustomerInfo } from "@/lib/customer-mode";
import { userDb } from "@/lib/supabase/server";
import type { Contract } from "@/lib/contracts/contract";
import type { Expense } from "@/lib/finances/pnl";
import type { Placement } from "@/lib/registers/placements";
import type { Show } from "@/lib/registers/shows";
import type { SyncLicense } from "@/lib/registers/sync";
import type { RightsPayment } from "@/lib/rights/payment";
import { normTitle, type Split } from "@/lib/splits/split";
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

export type CustomerContracts = { artists: { id: string; name: string }[]; contracts: Contract[] };

const CONTRACT_COLUMNS =
  "id, updated_at, artist_id, kind, counterparty, signed_on, starts_on, ends_on, notice_days, auto_renew, royalty_rate, advance_eur, recouped_eur, recouped_at, territory, exclusive, notes";
const toNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Les contrats que la personne a le droit de voir dans l'espace (RLS), et les artistes à qui les rattacher. */
export async function customerContracts(workspaceId: string): Promise<CustomerContracts> {
  const db = await userDb();
  const [{ data: artists, error: aErr }, { data: rows, error: cErr }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db.from("contracts").select(CONTRACT_COLUMNS).eq("workspace_id", workspaceId).order("created_at"),
  ]);
  if (aErr) throw aErr;
  if (cErr) throw cErr;
  // numeric Postgres → nombre JS (PostgREST peut les rendre en texte).
  const contracts = (rows ?? []).map((r) => ({
    ...r,
    notice_days: toNumber(r.notice_days),
    royalty_rate: toNumber(r.royalty_rate),
    advance_eur: toNumber(r.advance_eur),
    recouped_eur: toNumber(r.recouped_eur),
  })) as Contract[];
  return { artists: artists ?? [], contracts };
}

/** Titres du dernier relevé d'un artiste : revenus et streams par titre (indexés par normTitle). */
export type ArtistTitles = {
  titles: string[];
  revenue: Record<string, number>;
  streams: Record<string, number>;
  /** false : relevé importé avant le détail des revenus par titre. */
  hasRevenue: boolean;
  period: { from: string; to: string } | null;
};
export type CustomerSplits = { artists: { id: string; name: string }[]; splits: Split[]; titles: Record<string, ArtistTitles> };

/** Les splits visibles (RLS), les artistes, et les titres de leur dernier relevé pour calculer qui touche quoi. */
export async function customerSplits(workspaceId: string): Promise<CustomerSplits> {
  const db = await userDb();
  const [{ data: artists, error: aErr }, { data: rows, error: sErr }, { data: imports, error: iErr }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db.from("splits").select("id, updated_at, artist_id, title, isrc, status, notes, shares").eq("workspace_id", workspaceId).order("created_at"),
    db
      .from("artist_imports")
      .select("artist_id, trackRevenue:data->trackRevenue, trackStreams:data->trackStreams, months:data->months")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  if (aErr) throw aErr;
  if (sErr) throw sErr;
  if (iErr) throw iErr;
  const titles: Record<string, ArtistTitles> = {};
  for (const imp of imports ?? []) {
    if (titles[imp.artist_id]) continue; // le plus récent seulement
    const streams = (imp.trackStreams ?? {}) as Record<string, number>;
    const revenue = imp.trackRevenue as Record<string, number> | null;
    const months = ((imp.months ?? []) as string[]).slice().sort();
    const byNorm = (o: Record<string, number>) => {
      const out: Record<string, number> = {};
      for (const [t, v] of Object.entries(o)) out[normTitle(t)] = Math.round(((out[normTitle(t)] ?? 0) + v) * 100) / 100;
      return out;
    };
    titles[imp.artist_id] = {
      titles: Object.keys(streams).sort((a, b) => (streams[b] ?? 0) - (streams[a] ?? 0)),
      revenue: revenue ? byNorm(revenue) : {},
      streams: byNorm(streams),
      hasRevenue: Boolean(revenue),
      period: months.length ? { from: months[0], to: months[months.length - 1] } : null,
    };
  }
  return { artists: artists ?? [], splits: (rows ?? []) as Split[], titles };
}

export type CustomerRights = { artists: { id: string; name: string }[]; payments: RightsPayment[] };

/** Les versements de droits visibles (RLS), et les artistes à qui les rattacher. */
export async function customerRights(workspaceId: string): Promise<CustomerRights> {
  const db = await userDb();
  const [{ data: artists, error: aErr }, { data: rows, error: pErr }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db
      .from("rights_payments")
      .select("id, updated_at, artist_id, organism, paid_on, amount_eur, period_label, notes")
      .eq("workspace_id", workspaceId)
      .order("paid_on", { ascending: false }),
  ]);
  if (aErr) throw aErr;
  if (pErr) throw pErr;
  const payments = (rows ?? []).map((r) => ({ ...r, amount_eur: Number(r.amount_eur) })) as RightsPayment[];
  return { artists: artists ?? [], payments };
}

export type CustomerFinances = {
  artists: { id: string; name: string }[];
  expenses: Expense[];
  rights: { artistId: string; paid_on: string; amount_eur: number }[];
  statements: { artistId: string; revenueByMonth: Record<string, number> }[];
  shows: { artistId: string; show_date: string; fee_eur: number }[];
  sync: { artistId: string; paid_on: string; amount_eur: number }[];
};

/** Dépenses, droits et revenus des derniers relevés visibles (RLS) — pour le résultat mois par mois. */
export async function customerFinances(workspaceId: string): Promise<CustomerFinances> {
  const db = await userDb();
  const [
    { data: artists, error: aErr },
    { data: ex, error: eErr },
    { data: rg, error: rErr },
    { data: imports, error: iErr },
    { data: sh, error: shErr },
    { data: sy, error: syErr },
  ] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db.from("expenses").select("id, updated_at, artist_id, category, spent_on, amount_eur, label, notes").eq("workspace_id", workspaceId).order("spent_on", { ascending: false }),
    db.from("rights_payments").select("artist_id, paid_on, amount_eur").eq("workspace_id", workspaceId),
    db.from("artist_imports").select("artist_id, revenueByMonth:data->revenueByMonth").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    db.from("shows").select("artist_id, show_date, fee_eur").eq("workspace_id", workspaceId).not("fee_eur", "is", null),
    db.from("sync_licenses").select("artist_id, paid_on, fee_master_eur, fee_publishing_eur").eq("workspace_id", workspaceId).eq("status", "paid"),
  ]);
  for (const err of [aErr, eErr, rErr, iErr, shErr, syErr]) if (err) throw err;
  const seen = new Set<string>();
  const statements: CustomerFinances["statements"] = [];
  for (const imp of imports ?? []) {
    if (seen.has(imp.artist_id)) continue; // le plus récent seulement
    seen.add(imp.artist_id);
    statements.push({ artistId: imp.artist_id, revenueByMonth: (imp.revenueByMonth ?? {}) as Record<string, number> });
  }
  return {
    artists: artists ?? [],
    expenses: (ex ?? []).map((e) => ({ ...e, amount_eur: Number(e.amount_eur) })) as Expense[],
    rights: (rg ?? []).map((r) => ({ artistId: r.artist_id, paid_on: r.paid_on, amount_eur: Number(r.amount_eur) })),
    statements,
    shows: (sh ?? []).map((x) => ({ artistId: x.artist_id, show_date: x.show_date, fee_eur: Number(x.fee_eur) })),
    sync: (sy ?? [])
      .filter((x) => x.paid_on)
      .map((x) => ({ artistId: x.artist_id, paid_on: x.paid_on as string, amount_eur: Number(x.fee_master_eur ?? 0) + Number(x.fee_publishing_eur ?? 0) })),
  };
}

/** Registres saisis (concerts, placements, sync) : les lignes visibles (RLS) et les artistes. */
export type CustomerRegister<T> = { artists: { id: string; name: string }[]; rows: T[] };
const NUMERIC: Record<string, string[]> = {
  shows: ["gross_eur", "fee_eur"],
  placements: ["writer_share", "producer_points"],
  sync_licenses: ["fee_master_eur", "fee_publishing_eur"],
};
async function customerRegister<T>(table: "shows" | "placements" | "sync_licenses", workspaceId: string, order: string): Promise<CustomerRegister<T>> {
  const db = await userDb();
  const [{ data: artists, error: aErr }, { data: rows, error: rErr }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db.from(table).select("*").eq("workspace_id", workspaceId).order(order, { ascending: false }),
  ]);
  if (aErr) throw aErr;
  if (rErr) throw rErr;
  // numeric Postgres → nombre JS ; colonnes techniques retirées.
  const clean = (rows ?? []).map((r: Record<string, unknown>) => {
    const { workspace_id: _w, created_by: _c, created_at: _ca, ...rest } = r;
    for (const k of NUMERIC[table]) if (rest[k] !== null && rest[k] !== undefined) rest[k] = Number(rest[k]);
    return rest;
  });
  return { artists: artists ?? [], rows: clean as T[] };
}
export const customerShows = (ws: string) => customerRegister<Show>("shows", ws, "show_date");
export const customerPlacements = (ws: string) => customerRegister<Placement>("placements", ws, "created_at");
export const customerSync = (ws: string) => customerRegister<SyncLicense>("sync_licenses", ws, "created_at");
