-- Versements de droits saisis par le client (Day 1 Pro) : SACEM, ADAMI,
-- SPEDIDAM, SPRE, SCPP, SCPA… par artiste.
--
-- Ce que la structure DÉCLARE avoir reçu (montant, date, période couverte).
-- Pas encore d'import automatique des relevés d'organismes : sans exemple réel
-- de leurs fichiers, on ne devine pas un format.
-- Lecture : mêmes règles que les relevés ; écriture : serveur uniquement.

create table if not exists public.rights_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  organism text not null check (organism in ('sacem', 'adami', 'spedidam', 'spre', 'scpp', 'scpa', 'autre')),
  paid_on date not null,
  amount_eur numeric(12, 2) not null check (amount_eur between -1000000 and 100000000),
  period_label text check (char_length(period_label) <= 120),
  notes text check (char_length(notes) <= 2000)
);
create index if not exists rights_payments_workspace_idx on public.rights_payments (workspace_id);
create index if not exists rights_payments_artist_idx on public.rights_payments (artist_id, paid_on desc);

alter table public.rights_payments enable row level security;

drop policy if exists "membres : lecture des droits" on public.rights_payments;
create policy "membres : lecture des droits" on public.rights_payments
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id))
  );

revoke all on table public.rights_payments from anon, authenticated;
grant select on table public.rights_payments to authenticated;
grant select, insert, update, delete on table public.rights_payments to service_role;
