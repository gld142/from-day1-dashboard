-- Taux de change de référence de la BCE, moyenne MENSUELLE, relevés chaque nuit.
-- Sert à convertir un relevé en dollars ou en livres au taux du mois de chaque vente
-- (mesuré le 29/09/2026 : le taux fixe de l'import, 0,92 € pour 1 $, surévaluait
-- de ~6,7 % un relevé d'août 2026, où la BCE donnait 1 € = 1,1593 $).
-- Stocké tel que publié : unités de la devise pour 1 euro. Données publiques
-- (réutilisation autorisée en citant la BCE) : lecture pour tout compte connecté.
create table if not exists public.fx_monthly (
  currency text not null check (currency in ('USD', 'GBP')),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  units_per_eur numeric(14, 8) not null check (units_per_eur > 0),
  fetched_at timestamptz not null default now(),
  primary key (currency, month)
);

alter table public.fx_monthly enable row level security;
drop policy if exists "connectés : lecture" on public.fx_monthly;
create policy "connectés : lecture" on public.fx_monthly for select to authenticated using (true);
revoke all on table public.fx_monthly from anon, authenticated;
grant select on table public.fx_monthly to authenticated;
grant select, insert, update, delete on table public.fx_monthly to service_role;
