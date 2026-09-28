-- Relevés distributeur importés (DistroKid, TuneCore, Believe…), par artiste.
-- `data` = la projection déjà convertie en euros que le dashboard sait lire
-- (type UserData de src/lib/userdata/store.ts) ; le fichier brut n'est pas gardé.
-- Lecture : mêmes règles que les artistes (l'artiste invité ne voit que les siens).
-- Écriture : serveur uniquement, après vérification du rôle.

create table if not exists public.artist_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  file_name text check (char_length(file_name) <= 200),
  data jsonb not null check (pg_column_size(data) < 2000000)
);
create index if not exists artist_imports_artist_idx on public.artist_imports (artist_id, created_at desc);

alter table public.artist_imports enable row level security;

drop policy if exists "membres : lecture des relevés" on public.artist_imports;
create policy "membres : lecture des relevés" on public.artist_imports
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id))
  );

revoke all on table public.artist_imports from anon, authenticated;
grant select on table public.artist_imports to authenticated;
grant select, insert, update, delete on table public.artist_imports to service_role;
