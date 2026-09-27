-- Leads du parcours d'achat Day 1 Pro (/inscription).
-- Une lead naît à l'étape « identité » et se complète à chaque étape : si la
-- personne s'arrête avant de payer, on garde de quoi la rappeler.
--
-- Accès : serveur uniquement, avec la clé secrète. RLS activée SANS aucune règle
-- et aucun droit pour anon / authenticated : la table est fermée à l'API
-- publique, même avec la clé publishable.
--
-- Rejouable sans risque (if not exists / or replace).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Étape la plus avancée atteinte (voir le trigger : elle ne recule jamais).
  stage text not null default 'identity'
    check (stage in ('identity', 'structure', 'needs', 'offer', 'checkout', 'paid')),
  profile text
    check (profile in ('artist', 'label', 'management', 'publisher', 'distributor', 'other')),
  first_name text check (char_length(first_name) <= 80),
  last_name text check (char_length(last_name) <= 80),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 120),
  team_size text check (team_size in ('solo', '2-5', '6-20', '21-50', '50+')),
  artist_count integer check (artist_count between 1 and 500),
  roles text[] not null default '{}',
  needs text[] not null default '{}',
  notes text check (char_length(notes) <= 1000),
  consent boolean not null default false
);

comment on table public.leads is
  'Prospects du parcours d''achat Day 1 Pro. Serveur uniquement (clé secrète).';

create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_stage_idx on public.leads (stage, updated_at desc);

-- Fonctions internes : schéma non exposé par l'API.
create schema if not exists private;

create or replace function private.leads_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stages constant text[] := array['identity', 'structure', 'needs', 'offer', 'checkout', 'paid'];
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  -- Revenir à une étape précédente ne fait pas reculer la lead.
  if array_position(stages, new.stage) < array_position(stages, old.stage) then
    new.stage := old.stage;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_before_update on public.leads;
create trigger leads_before_update
  before update on public.leads
  for each row execute function private.leads_before_update();

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;
grant select, insert, update, delete on table public.leads to service_role;
