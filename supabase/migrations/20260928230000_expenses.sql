-- Dépenses saisies par le client (Day 1 Pro) : par artiste, ou de la structure
-- (artist_id nul = frais généraux). Elles entrent dans le résultat mois par mois
-- (/finances) face aux revenus des relevés et aux droits saisis.
-- Lecture : propriétaire/équipe tout ; l'artiste invité seulement les dépenses
-- de SON artiste (pas les frais de la structure). Écriture : serveur uniquement.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid references public.artists (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  category text not null check (category in ('studio', 'clip', 'marketing', 'distribution', 'promo', 'tour', 'other')),
  spent_on date not null,
  amount_eur numeric(12, 2) not null check (amount_eur > 0 and amount_eur <= 100000000),
  label text not null check (char_length(label) between 1 and 160),
  notes text check (char_length(notes) <= 2000)
);
create index if not exists expenses_workspace_idx on public.expenses (workspace_id, spent_on desc);

alter table public.expenses enable row level security;

drop policy if exists "membres : lecture des dépenses" on public.expenses;
create policy "membres : lecture des dépenses" on public.expenses
  for select to authenticated
  using (
    private.member_role(workspace_id) in ('owner', 'member')
    or (private.member_role(workspace_id) = 'artist' and artist_id is not null and artist_id = private.member_artist(workspace_id))
  );

revoke all on table public.expenses from anon, authenticated;
grant select on table public.expenses to authenticated;
grant select, insert, update, delete on table public.expenses to service_role;
