-- Retour arrière de 01_inscription_prestataire.sql.
-- NON APPLIQUÉ. Si 02_retire_ancienne_inscription.sql a été appliqué, appliquer d'abord SON retour arrière
-- (02_retire_ancienne_inscription.rollback.sql), sinon le site n'aurait plus aucune fonction d'inscription.
-- Le front qui appelle la nouvelle signature doit être retiré AVANT (sinon l'inscription renvoie une erreur).
--
-- 1. blade_my_provider() et blade_admin_overview() reviennent exactement à leur définition d'origine
--    (pg_get_functiondef du 2026-11-26) ; CREATE OR REPLACE garde les GRANT.
-- 2. La surcharge blade_register_provider(text, text, text, text, text, text, text) est supprimée
--    (DROP FUNCTION : aucune donnée) ; l'ancienne blade_register_provider(text), jamais modifiée, reste.
-- 3. ATTENTION, règle de Dédale (jamais de DROP COLUMN) : les six colonnes ne sont PAS supprimées mais
--    renommées first_name_retire, last_name_retire, phone_retire, instagram_retire, snapchat_retire,
--    tiktok_retire (contraintes renommées blade_providers_<colonne>_retire_check). Plus aucune fonction ne
--    les lit ni ne les écrit ; les valeurs déjà saisies restent récupérables par le superadmin en SQL
--    (ce sont des données personnelles : à purger si elles ne servent plus). La RLS de blade_providers
--    laisse toujours chaque prestataire relire sa propre ligne, colonnes _retire comprises, et rien d'autre.
--    Une suppression définitive (DROP COLUMN) est une décision séparée de l'utilisateur.
--    Après ce retour arrière, 01 peut être réappliquée (noms de colonnes et de contraintes libres).
--
-- Contrôle préalable : la garde ci-dessous (md5 des fonctions posées par la migration) est rejouée en tête
-- de transaction ; en SELECT, doit renvoyer 0 ligne :
--   SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND md5(pg_get_functiondef(p.oid)) <> CASE p.oid::regprocedure::text WHEN 'blade_register_provider(text)' THEN '83a268e4a877fc3a7e1c475c800d52cb' WHEN 'blade_admin_overview()' THEN 'ae238f857f8a76ff34a87054adc89224' WHEN 'blade_my_provider()' THEN 'd9b8002358c18216a5ba9271da20c7d3' WHEN 'blade_register_provider(text,text,text,text,text,text,text)' THEN '669229fc66d01ff19744ba0d6f39ed52' END;

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $g$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO bad FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.oid::regprocedure::text IN ('blade_register_provider(text)', 'blade_admin_overview()', 'blade_my_provider()', 'blade_register_provider(text,text,text,text,text,text,text)')
    AND md5(pg_get_functiondef(p.oid)) <> CASE p.oid::regprocedure::text
      WHEN 'blade_register_provider(text)' THEN '83a268e4a877fc3a7e1c475c800d52cb'
      WHEN 'blade_admin_overview()' THEN 'ae238f857f8a76ff34a87054adc89224'
      WHEN 'blade_my_provider()' THEN 'd9b8002358c18216a5ba9271da20c7d3'
      WHEN 'blade_register_provider(text,text,text,text,text,text,text)' THEN '669229fc66d01ff19744ba0d6f39ed52' END;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Retour arrière annulé : fonction(s) modifiée(s) depuis la migration : %', bad; END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::text IN ('blade_admin_overview()', 'blade_my_provider()', 'blade_register_provider(text,text,text,text,text,text,text)')) <> 3 THEN
    RAISE EXCEPTION 'Retour arrière annulé : la migration ne semble pas appliquée (fonction absente)';
  END IF;
  -- Sans l'ancienne signature (retirée par 02), le site n'aurait plus aucune fonction d'inscription.
  IF to_regprocedure('public.blade_register_provider(text)') IS NULL THEN
    RAISE EXCEPTION 'Retour arrière annulé : appliquer d''abord 02_retire_ancienne_inscription.rollback.sql (l''ancienne inscription est absente)';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blade_providers'
      AND column_name IN ('first_name', 'last_name', 'phone', 'instagram', 'snapchat', 'tiktok')) <> 6
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blade_providers'
      AND column_name IN ('first_name_retire', 'last_name_retire', 'phone_retire', 'instagram_retire', 'snapchat_retire', 'tiktok_retire')) THEN
    RAISE EXCEPTION 'Retour arrière annulé : colonnes absentes, ou colonnes _retire déjà présentes';
  END IF;
END $g$;

CREATE OR REPLACE FUNCTION public.blade_my_provider()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.blade_providers;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('provider', NULL, 'is_superadmin', false); END IF;
  UPDATE public.blade_providers SET last_active_at=now()
   WHERE user_id=auth.uid() AND status='active' AND last_active_at < now() - interval '5 minutes';
  SELECT * INTO r FROM public.blade_providers WHERE user_id=auth.uid();
  RETURN jsonb_build_object('is_superadmin', public.is_superadmin(), 'provider', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', r.id, 'status', r.status, 'display_name', r.display_name, 'email', r.email,
    'opt_payment_links', r.opt_payment_links, 'opt_auto_emails', r.opt_auto_emails, 'opt_searchable', r.opt_searchable,
    'revolut_url', r.revolut_url, 'stripe_link_url', r.stripe_link_url, 'created_at', r.created_at) END);
END $function$;

CREATE OR REPLACE FUNCTION public.blade_admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin'; END IF;
  RETURN jsonb_build_object(
    'providers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'display_name',p.display_name,'email',p.email,'status',p.status,'created_at',p.created_at,'validated_at',p.validated_at,
        'last_active_at',p.last_active_at,'opt_payment_links',p.opt_payment_links,'opt_auto_emails',p.opt_auto_emails,'opt_searchable',p.opt_searchable,
        'has_revolut',p.revolut_url IS NOT NULL,'has_stripe_link',p.stripe_link_url IS NOT NULL,'is_self',p.user_id=auth.uid(),
        'clients',(SELECT count(*) FROM public.clients c WHERE c.provider_id=p.id),
        'bookings',(SELECT count(*) FROM public.bookings b WHERE b.provider_id=p.id),
        -- Les rendez-vous historiques de LCS Barber (sans prestataire) comptent pour le compte superadmin.
        'honored',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)
                    AND (b.provider_id=p.id OR (b.provider_id IS NULL AND p.user_id=auth.uid()))))
      ORDER BY p.created_at) FROM public.blade_providers p),'[]'::jsonb),
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'created_at',c.created_at,
        'provider_id',c.provider_id,'provider_name',p.display_name,
        'honored',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)
                    AND (b.client_id=c.id OR (b.client_id IS NULL AND lower(b.client_email)=lower(c.email)))))
      ORDER BY c.name) FROM public.clients c LEFT JOIN public.blade_providers p ON p.id=c.provider_id),'[]'::jsonb),
    'honored_total',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)),
    'honored_clients',(SELECT count(DISTINCT COALESCE(b.client_id::text, lower(b.client_email))) FROM public.bookings b WHERE public.blade_booking_honored(b)),
    'unattributed_clients',(SELECT count(*) FROM public.clients WHERE provider_id IS NULL),
    'unattributed_bookings',(SELECT count(*) FROM public.bookings WHERE provider_id IS NULL));
END $function$;

DROP FUNCTION public.blade_register_provider(text, text, text, text, text, text, text);

ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_first_name_check TO blade_providers_first_name_retire_check;
ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_last_name_check TO blade_providers_last_name_retire_check;
ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_phone_check TO blade_providers_phone_retire_check;
ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_instagram_check TO blade_providers_instagram_retire_check;
ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_snapchat_check TO blade_providers_snapchat_retire_check;
ALTER TABLE public.blade_providers RENAME CONSTRAINT blade_providers_tiktok_check TO blade_providers_tiktok_retire_check;
ALTER TABLE public.blade_providers RENAME COLUMN first_name TO first_name_retire;
ALTER TABLE public.blade_providers RENAME COLUMN last_name TO last_name_retire;
ALTER TABLE public.blade_providers RENAME COLUMN phone TO phone_retire;
ALTER TABLE public.blade_providers RENAME COLUMN instagram TO instagram_retire;
ALTER TABLE public.blade_providers RENAME COLUMN snapchat TO snapchat_retire;
ALTER TABLE public.blade_providers RENAME COLUMN tiktok TO tiktok_retire;
COMMENT ON COLUMN public.blade_providers.first_name_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';
COMMENT ON COLUMN public.blade_providers.last_name_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';
COMMENT ON COLUMN public.blade_providers.phone_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';
COMMENT ON COLUMN public.blade_providers.instagram_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';
COMMENT ON COLUMN public.blade_providers.snapchat_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';
COMMENT ON COLUMN public.blade_providers.tiktok_retire IS 'Retiré (retour arrière inscription-prestataire) : plus lu ni écrit. Donnée personnelle, à purger si inutile.';

COMMIT;
