-- Facturation entre professionnels : la société et son SIRET (saisis au
-- paiement Stripe, repris sur les factures), et la résiliation programmée
-- (depuis le portail client Stripe : l'accès reste ouvert jusqu'à `cancel_at`).

alter table public.workspaces add column if not exists company_name text check (char_length(company_name) <= 200);
alter table public.workspaces add column if not exists siret text check (siret ~ '^[0-9]{14}$');
alter table public.workspaces add column if not exists cancel_at timestamptz;
