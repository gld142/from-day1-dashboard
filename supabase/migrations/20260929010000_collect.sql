-- Données réelles des pages Pulse, Marché, Audience, A&R, Day 1 Index (Day 1 Pro).
--
--   collection_runs  journal de la collecte automatique : une ligne par source et par passage
--   chart_entries    classements publics relevés chaque nuit (Apple Music, 10 pays)
--   tiktok_videos    vidéos TikTok qui utilisent le son d'un artiste, COLLÉES par l'équipe
--                    (jamais cherchées par un robot) ; Day 1 lit la fiche officielle (oEmbed)
--   tiktok_stats     chiffres recopiés depuis TikTok for Artists : réservés à l'espace du
--                    client (CGU TikTok for Artists §5.c), jamais mutualisés entre clients
--   ar_watchlist     artistes suivis par la structure (A&R)
--
-- Classements et journal : données publiques, lisibles par tout compte connecté.
-- Le reste : mêmes règles que les registres (l'artiste invité ne voit que les siens ;
-- la liste A&R est réservée au propriétaire et à l'équipe). Écriture : serveur seulement.

create table if not exists public.collection_runs (
  id bigint generated always as identity primary key,
  source text not null check (char_length(source) between 1 and 60),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'error')),
  rows integer check (rows >= 0),
  detail text check (char_length(detail) <= 2000)
);
create index if not exists collection_runs_source_idx on public.collection_runs (source, started_at desc);

create table if not exists public.chart_entries (
  source text not null check (source in ('apple_music')),
  chart text not null check (chart in ('most-played-songs')),
  country text not null check (country ~ '^[a-z]{2}$'),
  chart_date date not null,
  position smallint not null check (position between 1 and 200),
  item_id text not null check (char_length(item_id) between 1 and 40),
  title text not null check (char_length(title) between 1 and 400),
  artist_name text not null check (char_length(artist_name) between 1 and 400),
  artist_ext_id text check (char_length(artist_ext_id) <= 40),
  url text check (char_length(url) <= 500),
  genres text[] not null default '{}',
  release_date date,
  collected_at timestamptz not null default now(),
  primary key (source, chart, country, chart_date, position)
);
create index if not exists chart_entries_latest_idx on public.chart_entries (source, chart, country, chart_date desc);

create table if not exists public.tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  video_id text not null check (video_id ~ '^[0-9]{5,25}$'),
  video_url text not null check (char_length(video_url) <= 300),
  author_name text check (char_length(author_name) <= 200),
  author_handle text check (char_length(author_handle) <= 100),
  title text check (char_length(title) <= 2500),
  sound_title text check (char_length(sound_title) <= 300),
  sound_url text check (char_length(sound_url) <= 500),
  thumbnail_url text check (char_length(thumbnail_url) <= 2000),
  thumbnail_expires_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'gone')),
  checked_at timestamptz not null default now(),
  views bigint check (views >= 0),
  views_on date,
  notes text check (char_length(notes) <= 2000),
  check ((views is null) = (views_on is null)),
  unique (workspace_id, video_id)
);
create index if not exists tiktok_videos_workspace_idx on public.tiktok_videos (workspace_id, artist_id);

create table if not exists public.tiktok_stats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  as_of date not null,
  scope text not null default 'account' check (scope in ('account', 'track')),
  track_title text check (char_length(track_title) between 1 and 300),
  period_days smallint check (period_days in (7, 28, 60, 365)),
  followers bigint check (followers >= 0),
  likes bigint check (likes >= 0),
  video_views bigint check (video_views >= 0),
  profile_views bigint check (profile_views >= 0),
  track_videos bigint check (track_videos >= 0),
  track_views bigint check (track_views >= 0),
  notes text check (char_length(notes) <= 2000),
  check ((scope = 'track') = (track_title is not null))
);
create index if not exists tiktok_stats_workspace_idx on public.tiktok_stats (workspace_id, artist_id, as_of desc);

create table if not exists public.ar_watchlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  artist_name text not null check (char_length(artist_name) between 1 and 160),
  notes text check (char_length(notes) <= 2000)
);
create unique index if not exists ar_watchlist_name_idx on public.ar_watchlist (workspace_id, lower(artist_name));

-- Données publiques : lecture pour tout compte connecté.
do $$
declare t text;
begin
  foreach t in array array['collection_runs', 'chart_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "connectés : lecture" on public.%I', t);
    execute format('create policy "connectés : lecture" on public.%I for select to authenticated using (true)', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
grant usage on sequence public.collection_runs_id_seq to service_role;

-- Données d'un espace, par artiste.
do $$
declare t text;
begin
  foreach t in array array['tiktok_videos', 'tiktok_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membres : lecture" on public.%I', t);
    execute format($p$create policy "membres : lecture" on public.%I for select to authenticated using (
      private.member_role(workspace_id) in ('owner', 'member')
      or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id)))$p$, t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

-- Liste A&R : vue structure, propriétaire et équipe seulement.
alter table public.ar_watchlist enable row level security;
drop policy if exists "structure : lecture" on public.ar_watchlist;
create policy "structure : lecture" on public.ar_watchlist for select to authenticated
  using (private.member_role(workspace_id) in ('owner', 'member'));
revoke all on table public.ar_watchlist from anon, authenticated;
grant select on table public.ar_watchlist to authenticated;
grant select, insert, update, delete on table public.ar_watchlist to service_role;
