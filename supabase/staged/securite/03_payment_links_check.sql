-- Sécurité : les liens d'acompte des prestataires ne peuvent être que des liens
-- https://revolut.me/… ou https://buy.stripe.com/… (mêmes règles que provider-admin-model.ts).
-- Avant : blade_update_own_provider acceptait n'importe quel texte (javascript:, site de phishing).
-- À appliquer après vérification : aucune ligne existante ne doit être refusée (requête 1).

-- 1. Contrôle préalable : doit renvoyer 0 ligne. Sinon, corriger ces liens avant l'étape 2.
SELECT id, display_name, revolut_url, stripe_link_url FROM public.blade_providers
WHERE (NULLIF(trim(revolut_url), '') IS NOT NULL AND revolut_url !~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$')
   OR (NULLIF(trim(stripe_link_url), '') IS NOT NULL AND stripe_link_url !~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$');

-- 2. Contraintes sur la table (protègent aussi les écritures futures, quel que soit le chemin).
ALTER TABLE public.blade_providers
  ADD CONSTRAINT blade_providers_revolut_url_check
    CHECK (NULLIF(trim(revolut_url), '') IS NULL OR revolut_url ~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$'),
  ADD CONSTRAINT blade_providers_stripe_link_url_check
    CHECK (NULLIF(trim(stripe_link_url), '') IS NULL OR stripe_link_url ~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$');
