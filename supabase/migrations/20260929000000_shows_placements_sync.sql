-- Trois registres saisis par le client (Day 1 Pro), par artiste :
--   shows         dates de concert (billetterie, cachet)
--   placements    œuvres écrites/produites pour d'autres interprètes
--   sync_licenses licences de synchronisation (pub, film, série, jeu…)
-- Tout est DÉCLARÉ par la structure ; Day 1 en tire des totaux et des alertes,
-- et verse cachets et licences encaissées dans le résultat (/finances).
-- Lecture : mêmes règles que les relevés (l'artiste invité ne voit que les
-- siens) ; écriture : serveur uniquement, après vérification du rôle.

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  show_date date not null,
  city text not null check (char_length(city) between 1 and 80),
  country text check (country ~ '^[A-Z]{2}$'),
  venue text check (char_length(venue) <= 120),
  capacity integer check (capacity between 0 and 1000000),
  tickets_sold integer check (tickets_sold between 0 and 1000000),
  gross_eur numeric(12, 2) check (gross_eur >= 0),
  fee_eur numeric(12, 2) check (fee_eur >= 0),
  notes text check (char_length(notes) <= 2000),
  check (capacity is null or tickets_sold is null or tickets_sold <= capacity)
);
create index if not exists shows_workspace_idx on public.shows (workspace_id, show_date);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  performer text not null check (char_length(performer) between 1 and 160),
  roles text[] not null default '{}' check (roles <@ array['auteur', 'compositeur', 'producteur']::text[]),
  writer_share numeric(5, 2) check (writer_share between 0 and 100),
  producer_points numeric(5, 2) check (producer_points between 0 and 100),
  status text not null check (status in ('pitched', 'signed', 'released')),
  release_date date,
  sacem_declared boolean not null default false,
  notes text check (char_length(notes) <= 2000)
);
create index if not exists placements_workspace_idx on public.placements (workspace_id);

create table if not exists public.sync_licenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  track_title text not null check (char_length(track_title) between 1 and 300),
  project text not null check (char_length(project) between 1 and 200),
  media text not null check (media in ('pub', 'film', 'serie', 'jeu', 'tv', 'web', 'autre')),
  client text check (char_length(client) <= 160),
  territory text check (char_length(territory) <= 120),
  term text check (char_length(term) <= 120),
  fee_master_eur numeric(12, 2) check (fee_master_eur >= 0),
  fee_publishing_eur numeric(12, 2) check (fee_publishing_eur >= 0),
  status text not null check (status in ('proposed', 'negotiating', 'signed', 'paid', 'lost')),
  signed_on date,
  paid_on date,
  notes text check (char_length(notes) <= 2000),
  check (status <> 'paid' or paid_on is not null)
);
create index if not exists sync_licenses_workspace_idx on public.sync_licenses (workspace_id);

do $$
declare t text;
begin
  foreach t in array array['shows', 'placements', 'sync_licenses'] loop
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
