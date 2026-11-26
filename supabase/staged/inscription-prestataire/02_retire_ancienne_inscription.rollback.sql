-- Retour arrière de 02_retire_ancienne_inscription.sql : recrée blade_register_provider(text) à l'identique
-- (pg_get_functiondef du 2026-11-26) avec ses droits d'origine ({postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}).
-- NON APPLIQUÉ. À appliquer avant le retour arrière de 01 si celui-ci devient nécessaire.
--
-- Contrôle préalable : doit renvoyer 0 ligne.
--   SELECT 'deja presente' FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text = 'blade_register_provider(text)';

BEGIN;

DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text = 'blade_register_provider(text)') THEN
    RAISE EXCEPTION 'Retour arrière annulé : blade_register_provider(text) existe déjà';
  END IF;
END $g$;

CREATE FUNCTION public.blade_register_provider(p_display_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF EXISTS(SELECT 1 FROM public.blade_providers WHERE user_id=auth.uid()) THEN RETURN public.blade_my_provider(); END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.blade_providers(id,user_id,status,display_name,email)
  VALUES (gen_random_uuid(), auth.uid(), 'pending', trim(p_display_name), lower(v_email));
  RETURN public.blade_my_provider();
END $function$;

REVOKE ALL ON FUNCTION public.blade_register_provider(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_register_provider(text) TO authenticated, service_role;

COMMIT;
