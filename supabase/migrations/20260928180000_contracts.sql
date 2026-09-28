-- Contrats saisis par le client (Day 1 Pro), par artiste.
--
-- Ce que le client DÉCLARE de ses contrats (dates, préavis, avance, taux…) :
-- Day 1 en tire les échéances (fin, date limite de préavis) et le reste à
-- recouper. Le PDF du contrat n'est pas stocké (pas encore).
-- Lecture : mêmes règles que les relevés (l'artiste invité ne voit que les siens).
-- Écriture : serveur uniquement (clé secrète), après vérification du rôle
-- (propriétaire ou équipe).

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  kind text not null
    check (kind in ('artiste', 'licence', 'distribution', 'edition', 'management', 'booking', 'sync', 'autre')),
  counterparty text not null check (char_length(counterparty) between 1 and 160),
  signed_on date,
  starts_on date,
  ends_on date,
  notice_days integer check (notice_days between 0 and 3650),
  auto_renew boolean not null default false,
  royalty_rate numeric(5, 2) check (royalty_rate between 0 and 100),
  advance_eur numeric(12, 2) check (advance_eur >= 0),
  recouped_eur numeric(12, 2) check (recouped_eur >= 0),
  recouped_at date,
  territory text check (char_length(territory) <= 120),
  exclusive boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists contracts_workspace_idx on public.contracts (workspace_id);
create index if not exists contracts_artist_idx on public.contracts (artist_id);

alter table public.contracts enable row level security;

drop policy if exists "membres : lecture des contrats" on public.contracts;
create policy "membres : lecture des contrats" on public.contracts
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id))
  );

revoke all on table public.contracts from anon, authenticated;
grant select on table public.contracts to authenticated;
grant select, insert, update, delete on table public.contracts to service_role;
