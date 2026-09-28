-- Splits saisis par le client (Day 1 Pro) : qui touche quoi sur chaque titre.
--
-- Deux couches par participant : `master` (l'enregistrement — ce que paient les
-- plateformes via le distributeur) et `publishing` (droits d'auteur, via la
-- SACEM). Les parts sont DÉCLARÉES ; « agreed » = accord déclaré par la
-- structure, PAS une signature électronique.
-- `shares` : tableau JSON [{name, role, email?, master, publishing}], validé
-- côté serveur (src/lib/splits/split.ts) avant toute écriture.
-- Lecture : mêmes règles que les relevés ; écriture : serveur uniquement.

create table if not exists public.splits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  isrc text check (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
  status text not null default 'draft' check (status in ('draft', 'agreed')),
  shares jsonb not null check (jsonb_typeof(shares) = 'array' and jsonb_array_length(shares) between 1 and 20),
  notes text check (char_length(notes) <= 2000)
);
create index if not exists splits_workspace_idx on public.splits (workspace_id);
create index if not exists splits_artist_idx on public.splits (artist_id);

alter table public.splits enable row level security;

drop policy if exists "membres : lecture des splits" on public.splits;
create policy "membres : lecture des splits" on public.splits
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id))
  );

revoke all on table public.splits from anon, authenticated;
grant select on table public.splits to authenticated;
grant select, insert, update, delete on table public.splits to service_role;
