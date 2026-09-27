-- Comptes Day 1 Pro : espaces, artistes, membres, invitations.
--
-- Un abonnement = un espace (structure) + ses artistes, facturés à l'artiste.
-- Lecture : un membre ne voit que ses espaces ; un membre « artist » ne voit que
-- son artiste ; les invitations ne sont visibles que du propriétaire.
-- Écriture : UNIQUEMENT côté serveur (clé secrète), après vérification du rôle.
-- Aucun droit pour anon ; authenticated n'a que SELECT, filtré par la RLS.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null
    check (kind in ('artist', 'label', 'management', 'publisher', 'distributor', 'other')),
  lead_id uuid references public.leads (id) on delete set null,
  -- Abonnement Stripe (source de vérité : Stripe ; ici, la copie utile à l'app).
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  subscription_status text not null default 'incomplete',
  artist_quantity integer not null default 1 check (artist_quantity >= 1),
  current_period_end timestamptz,
  -- Connexion automatique après paiement : seulement si le compte a été créé par
  -- ce paiement, et une seule fois.
  owner_created_by_checkout boolean not null default false,
  owner_autologin_at timestamptz
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120)
);
create index if not exists artists_workspace_idx on public.artists (workspace_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  email text not null,
  role text not null check (role in ('owner', 'member', 'artist')),
  artist_id uuid references public.artists (id) on delete set null,
  primary key (workspace_id, user_id),
  check (role <> 'artist' or artist_id is not null)
);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (char_length(email) <= 200),
  role text not null check (role in ('member', 'artist')),
  artist_id uuid references public.artists (id) on delete cascade,
  -- Empreinte SHA-256 du jeton du lien : le jeton lui-même n'est jamais stocké.
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  check (role <> 'artist' or artist_id is not null)
);
create index if not exists invitations_workspace_idx on public.invitations (workspace_id);

-- Qui suis-je dans cet espace ? (security definer : évite la récursion RLS sur
-- workspace_members ; schéma private, non exposé par l'API.)
create schema if not exists private;

create or replace function private.member_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

create or replace function private.member_artist(ws uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.artist_id from public.workspace_members m
  where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

revoke all on function private.member_role(uuid) from public, anon;
revoke all on function private.member_artist(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.member_artist(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.artists enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

drop policy if exists "membres : lecture de leur espace" on public.workspaces;
create policy "membres : lecture de leur espace" on public.workspaces
  for select to authenticated
  using (private.member_role(id) is not null);

drop policy if exists "membres : lecture des artistes" on public.artists;
create policy "membres : lecture des artistes" on public.artists
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and id = private.member_artist(workspace_id))
  );

drop policy if exists "membres : lecture de l'équipe" on public.workspace_members;
create policy "membres : lecture de l'équipe" on public.workspace_members
  for select to authenticated
  using (private.member_role(workspace_id) is not null);

drop policy if exists "propriétaire : lecture des invitations" on public.invitations;
create policy "propriétaire : lecture des invitations" on public.invitations
  for select to authenticated
  using (private.member_role(workspace_id) = 'owner');

revoke all on table public.workspaces, public.artists, public.workspace_members, public.invitations
  from anon, authenticated;
grant select on table public.workspaces, public.artists, public.workspace_members, public.invitations
  to authenticated;
grant select, insert, update, delete
  on table public.workspaces, public.artists, public.workspace_members, public.invitations
  to service_role;
