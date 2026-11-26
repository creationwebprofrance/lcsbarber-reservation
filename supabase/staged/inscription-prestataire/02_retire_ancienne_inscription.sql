-- Retrait de l'ancienne inscription blade_register_provider(text) (sans prénom, nom ni téléphone).
-- NON APPLIQUÉ. À appliquer SEULEMENT APRÈS 01_inscription_prestataire.sql ET la mise en ligne du front qui
-- appelle blade_register_provider(p_display_name, p_first_name, p_last_name, p_phone, …), vérifiée par Argus.
-- Avant cela, le site en ligne appelle encore l'ancienne : la retirer casserait l'inscription.
--
-- Pourquoi la supprimer plutôt que la garder : tant qu'elle existe, n'importe quel compte connecté peut
-- s'inscrire sans prénom, nom ni téléphone en l'appelant directement ; « obligatoire côté serveur » ne
-- serait vrai qu'à moitié. DROP FUNCTION ne touche aucune donnée et le retour arrière la recrée à
-- l'identique (définition pg_get_functiondef du 2026-11-26, mêmes droits : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}).
-- Risque : un onglet resté ouvert sur l'ancien front reçoit « Could not find the function » à l'inscription
-- (il suffit de recharger la page).
--
-- Contrôle préalable : doit renvoyer 0 ligne.
--   SELECT 'fonction modifiee : blade_register_provider(text)' FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text = 'blade_register_provider(text)' AND md5(pg_get_functiondef(p.oid)) <> '83a268e4a877fc3a7e1c475c800d52cb'
--   UNION ALL SELECT 'nouvelle signature absente ou modifiee' WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text = 'blade_register_provider(text,text,text,text,text,text,text)' AND md5(pg_get_functiondef(p.oid)) = '669229fc66d01ff19744ba0d6f39ed52');
--
-- Retour arrière : 02_retire_ancienne_inscription.rollback.sql

BEGIN;

DO $g$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::text = 'blade_register_provider(text,text,text,text,text,text,text)' AND md5(pg_get_functiondef(p.oid)) = '669229fc66d01ff19744ba0d6f39ed52') THEN
    RAISE EXCEPTION 'Retrait annulé : la nouvelle inscription (01) est absente ou modifiée';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::text = 'blade_register_provider(text)' AND md5(pg_get_functiondef(p.oid)) = '83a268e4a877fc3a7e1c475c800d52cb') THEN
    RAISE EXCEPTION 'Retrait annulé : blade_register_provider(text) est absente ou modifiée depuis la préparation';
  END IF;
END $g$;

DROP FUNCTION public.blade_register_provider(text);

COMMIT;
