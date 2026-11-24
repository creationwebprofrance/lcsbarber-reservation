-- Retour arrière de 03_payment_links_check.sql
ALTER TABLE public.blade_providers
  DROP CONSTRAINT IF EXISTS blade_providers_revolut_url_check,
  DROP CONSTRAINT IF EXISTS blade_providers_stripe_link_url_check;
