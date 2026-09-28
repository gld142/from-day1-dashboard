-- SIRET saisi dans le parcours d'achat, AVANT le paiement : Stripe le reçoit
-- dès la création du client, donc il figure aussi sur la toute première facture.

alter table public.leads add column if not exists siret text check (siret ~ '^[0-9]{14}$');
