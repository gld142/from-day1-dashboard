import { cookies } from "next/headers";
import type { CustomerInfo } from "@/lib/customer-mode";
import { userDb } from "@/lib/supabase/server";
import { isWorkspaceKind, viewFor, type MemberRole } from "@/lib/accounts/view";
import type { Contract } from "@/lib/contracts/contract";
import type { Expense } from "@/lib/finances/pnl";
import type { Placement } from "@/lib/registers/placements";
import type { Show } from "@/lib/registers/shows";
import type { SyncLicense } from "@/lib/registers/sync";
import type { RightsPayment } from "@/lib/rights/payment";
import { normTitle, type Split } from "@/lib/splits/split";
import type { RosterArtist, RosterStatement } from "@/lib/userdata/roster";
import type { UserData } from "@/lib/userdata/store";
import type { SourceRun } from "@/lib/collect/freshness";
import type { ChartRow } from "@/lib/market/charts";
import type { TikTokStat } from "@/lib/tiktok/forms";
import type { TikTokVideo } from "@/lib/tiktok/video";

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
    db.from("workspaces").select("name, kind, subscription_status").eq("id", artist.workspace_id).single(),
    db.from("workspace_members").select("role").eq("workspace_id", artist.workspace_id).eq("user_id", auth.user.id).single(),
    db.from("artist_imports").select("data").eq("artist_id", artist.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!ws || !me || !OPEN.has(ws.subscription_status)) return { kind: "blocked", reason: "subscription" };
  const workspaceKind = isWorkspaceKind(ws.kind) ? ws.kind : "other";
  const role = me.role as MemberRole;
  return {
    kind: "customer",
    info: {
      userId: auth.user.id,
      workspaceId: artist.workspace_id,
      email: auth.user.email ?? "",
      workspaceName: ws.name,
      workspaceKind,
      view: viewFor(workspaceKind, role),
      role,
      artistId: artist.id,
      artistName: artist.name,
      artists: artists.filter((a) => a.workspace_id === artist.workspace_id).map((a) => ({ id: a.id, name: a.name })),
    },
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

/**
 * Marché & signaux (Pulse, Marché, Audience, A&R) : classements publics relevés
 * chaque nuit, journal de la collecte, vidéos TikTok collées et chiffres TikTok
 * for Artists saisis (RLS : l'artiste invité ne voit que les siens), liste A&R
 * (structure seulement). Chaque morceau n'est chargé que si la page le lit.
 */
export type ChartSnapshot = { latestDate: string | null; previousDate: string | null; latest: ChartRow[]; previous: ChartRow[] };
export type WatchItem = { id: string; artist_name: string; notes: string | null; created_at: string };
export type WikiLink = { artist_id: string | null; watch_id: string | null; qid: string | null; project: string | null; article: string | null; method: "auto" | "manual" | "none"; checked_at: string };
/** Liens vers Wikipédia de l'espace, et vues par jour de chaque article (clé « projet|article »), 120 derniers jours. */
export type CustomerWiki = { links: WikiLink[]; views: Record<string, { day: string; views: number }[]> };
export type CustomerSignals = {
  artists: { id: string; name: string }[];
  runs: SourceRun[];
  charts: ChartSnapshot | null;
  videos: TikTokVideo[] | null;
  stats: TikTokStat[] | null;
  watchlist: WatchItem[] | null;
  wiki: CustomerWiki | null;
};

const CHART_COLUMNS = "country, chart_date, position, item_id, title, artist_name, artist_ext_id, url, genres, release_date";
const PAGE = 1000; // plafond de lignes par requête côté Supabase

async function chartRows(db: Awaited<ReturnType<typeof userDb>>, chartDate: string): Promise<ChartRow[]> {
  const rows: ChartRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("chart_entries")
      .select(CHART_COLUMNS)
      .eq("source", "apple_music")
      .eq("chart", "most-played-songs")
      .eq("chart_date", chartDate)
      .order("country")
      .order("position")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ChartRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function customerSignals(workspaceId: string, needs: { charts?: boolean; tiktok?: boolean; watchlist?: boolean; wiki?: boolean }): Promise<CustomerSignals> {
  const db = await userDb();
  const [{ data: artists, error: aErr }, { data: runs, error: rErr }] = await Promise.all([
    db.from("artists").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    db.from("collection_runs").select("id, source, status, started_at, finished_at, rows, detail").order("id", { ascending: false }).limit(40),
  ]);
  if (aErr) throw aErr;
  if (rErr) throw rErr;

  let charts: ChartSnapshot | null = null;
  if (needs.charts) {
    const base = () => db.from("chart_entries").select("chart_date").eq("source", "apple_music").eq("chart", "most-played-songs").order("chart_date", { ascending: false }).limit(1);
    const { data: last, error } = await base();
    if (error) throw error;
    const latestDate = (last?.[0]?.chart_date as string | undefined) ?? null;
    let previousDate: string | null = null;
    if (latestDate) {
      const { data: prev, error: pErr } = await base().lt("chart_date", latestDate);
      if (pErr) throw pErr;
      previousDate = (prev?.[0]?.chart_date as string | undefined) ?? null;
    }
    const [latest, previous] = await Promise.all([latestDate ? chartRows(db, latestDate) : [], previousDate ? chartRows(db, previousDate) : []]);
    charts = { latestDate, previousDate, latest, previous };
  }

  let videos: TikTokVideo[] | null = null;
  let stats: TikTokStat[] | null = null;
  if (needs.tiktok) {
    const [{ data: v, error: vErr }, { data: s, error: sErr }] = await Promise.all([
      db
        .from("tiktok_videos")
        .select("id, created_at, artist_id, video_id, video_url, author_name, author_handle, title, sound_title, sound_url, thumbnail_url, thumbnail_expires_at, status, checked_at, views, views_on, notes")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      db
        .from("tiktok_stats")
        .select("id, updated_at, artist_id, as_of, scope, track_title, period_days, followers, likes, video_views, profile_views, track_videos, track_views, notes")
        .eq("workspace_id", workspaceId)
        .order("as_of", { ascending: false }),
    ]);
    if (vErr) throw vErr;
    if (sErr) throw sErr;
    const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
    videos = (v ?? []).map((r) => ({ ...r, views: num(r.views) })) as TikTokVideo[];
    stats = (s ?? []).map((r) => ({
      ...r,
      period_days: num(r.period_days),
      followers: num(r.followers),
      likes: num(r.likes),
      video_views: num(r.video_views),
      profile_views: num(r.profile_views),
      track_videos: num(r.track_videos),
      track_views: num(r.track_views),
    })) as TikTokStat[];
  }

  let watchlist: WatchItem[] | null = null;
  if (needs.watchlist) {
    const { data, error } = await db.from("ar_watchlist").select("id, artist_name, notes, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (error) throw error;
    watchlist = (data ?? []) as WatchItem[];
  }

  let wiki: CustomerWiki | null = null;
  if (needs.wiki) {
    const { data: links, error: lErr } = await db.from("wiki_links").select("artist_id, watch_id, qid, project, article, method, checked_at").eq("workspace_id", workspaceId);
    if (lErr) throw lErr;
    const articles = [...new Set((links ?? []).filter((l) => l.article).map((l) => l.article as string))];
    const views: CustomerWiki["views"] = {};
    if (articles.length) {
      const since = new Date(Date.now() - 121 * 86_400_000).toISOString().slice(0, 10);
      const { data: pv, error: pErr } = await db.from("wiki_pageviews").select("project, article, day, views").in("article", articles).gte("day", since).order("day").limit(20_000);
      if (pErr) throw pErr;
      for (const r of pv ?? []) (views[`${r.project}|${r.article}`] ??= []).push({ day: r.day as string, views: Number(r.views) });
    }
    wiki = { links: (links ?? []) as WikiLink[], views };
  }

  return {
    wiki,
    artists: artists ?? [],
    runs: (runs ?? []).map((r) => ({ ...r, id: String(r.id) })) as SourceRun[],
    charts,
    videos,
    stats,
    watchlist,
  };
}
