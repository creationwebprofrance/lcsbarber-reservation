-- Inscription prestataire : prénom, nom, téléphone, Instagram, Snapchat et TikTok.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur, AVANT la mise en ligne
-- du front qui appelle la nouvelle signature (le front actuel continue de marcher pendant l'intervalle).
--
-- Pourquoi : le propriétaire veut connaître l'identité et les réseaux de chaque prestataire qui s'inscrit
-- (/blade/devenir-pro, src/blade/become-provider.tsx → registerProvider, src/blade/data.ts).
--
-- Ce que fait la migration (additive) :
-- 1. Six colonnes NULLABLES sur blade_providers : first_name, last_name, phone, instagram, snapchat, tiktok
--    (text), avec une contrainte CHECK chacune (blade_providers_<colonne>_check) :
--      prénom / nom : 1 à 60 caractères, sans espace au début ni à la fin, sans caractère de contrôle ;
--      téléphone : 8 à 20 caractères, + facultatif au début, puis chiffres, espaces, points ou tirets,
--                  commence et finit par un chiffre, 8 à 15 chiffres au total (E.164 : 15 au plus) ;
--      pseudos : 1 à 30 caractères parmi lettres, chiffres, point et tiret bas (donc jamais de « @ »).
--    Les lignes existantes gardent NULL partout : elles restent valides.
--    Le trigger blade_validate_provider n'est pas modifié : les contrôles passent par la RPC et les CHECK.
-- 2. NOUVELLE surcharge blade_register_provider(p_display_name, p_first_name, p_last_name, p_phone,
--    p_instagram DEFAULT NULL, p_snapchat DEFAULT NULL, p_tiktok DEFAULT NULL) -> jsonb (= blade_my_provider()).
--    Mêmes contrôles que l'ancienne (connexion requise ; compte déjà existant : renvoie blade_my_provider()
--    sans rien modifier ; statut 'pending' ; e-mail lu dans auth.users), puis : prénom, nom, téléphone
--    obligatoires (« Prénom requis », « Nom requis », « Téléphone requis », « Téléphone invalide … ») ;
--    pseudos nettoyés (espaces et « @ » initiaux retirés), puis vérifiés (« Pseudo Instagram invalide … »).
--    EXECUTE : authenticated et service_role seulement (comme l'ancienne ; ni anon ni PUBLIC).
--    L'ANCIENNE blade_register_provider(text) est GARDÉE TELLE QUELLE (md5 vérifié) : le site en ligne
--    l'appelle avec { p_display_name } seul ; PostgREST choisit la surcharge par les noms d'arguments, la
--    nouvelle exige p_first_name/p_last_name/p_phone, il n'y a donc pas d'ambiguïté. Elle sera retirée par
--    02_retire_ancienne_inscription.sql, une fois le nouveau front en ligne (sinon on peut toujours
--    s'inscrire sans prénom/nom/téléphone en appelant l'ancienne directement).
-- 3. blade_admin_overview() (superadmin seulement, contrôle is_superadmin inchangé) renvoie aussi
--    first_name, last_name, phone, instagram, snapchat, tiktok pour chaque prestataire.
-- 4. blade_my_provider() renvoie aussi ces six champs, pour le seul compte connecté (auth.uid()).
-- Fonctions modifiées reprises intégralement de pg_get_functiondef (2026-11-26) ; seules les lignes
-- commentées changent ; CREATE OR REPLACE garde propriétaire et GRANT.
--
-- Confidentialité : aucune autre fonction ne lit ces colonnes. blade_public_page, blade_public_providers
-- (recherche), blade_public_showcase et les autres RPC accessibles à anon ne lisent que des colonnes
-- nommées de blade_providers (id, display_name, status…), jamais la ligne entière ; les fonctions edge
-- font des select() à colonnes nommées. En lecture directe, la RLS de blade_providers (« Provider or
-- superadmin reads » : user_id = auth.uid() OR is_superadmin(), aucune politique pour anon, aucune
-- politique d'écriture) ne laisse voir à un prestataire que sa propre ligne.
-- À ne pas confondre avec blade_provider_pages.instagram / tiktok, qui sont PUBLICS (profil affiché).
--
-- Risques :
--   - ALTER TABLE prend un verrou ACCESS EXCLUSIVE bref sur blade_providers (table lue par presque toutes
--     les RPC) : lock_timeout de 5 s, la migration échoue proprement plutôt que d'attendre.
--   - Tant que 02 n'est pas appliqué, l'ancienne signature permet une inscription sans ces champs.
--   - Un prestataire déjà inscrit (ou inscrit par l'ancien front pendant l'intervalle) n'a aucun moyen de
--     renseigner ces champs : il n'existe pas encore de RPC de mise à jour (à préparer si besoin).
--   - Pseudos Snapchat contenant un tiret : refusés (règle demandée : lettres, chiffres, point, tiret bas).
--
-- Contrôle préalable : doit renvoyer 0 ligne (sinon, ne pas appliquer et faire reprendre par Dédale).
--   SELECT 'fonction modifiee : ' || p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text IN ('blade_register_provider(text)', 'blade_admin_overview()', 'blade_my_provider()') AND md5(pg_get_functiondef(p.oid)) <> CASE p.oid::regprocedure::text WHEN 'blade_register_provider(text)' THEN '83a268e4a877fc3a7e1c475c800d52cb' WHEN 'blade_admin_overview()' THEN '0cb6946eb85db05e12108c890b50014a' WHEN 'blade_my_provider()' THEN '0c4671e969ed431b0606ae202ae9c109' END
--   UNION ALL SELECT 'fonction absente : ' || f FROM unnest(ARRAY['blade_register_provider(text)', 'blade_admin_overview()', 'blade_my_provider()']) f WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.oid::regprocedure::text = f)
--   UNION ALL SELECT 'autre version : ' || p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'blade_register_provider' AND p.oid::regprocedure::text <> 'blade_register_provider(text)'
--   UNION ALL SELECT 'colonne existe deja : ' || column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blade_providers' AND column_name IN ('first_name', 'last_name', 'phone', 'instagram', 'snapchat', 'tiktok')
--   UNION ALL SELECT 'contrainte existe deja : ' || conname FROM pg_constraint WHERE conrelid = 'public.blade_providers'::regclass AND conname IN ('blade_providers_first_name_check', 'blade_providers_last_name_check', 'blade_providers_phone_check', 'blade_providers_instagram_check', 'blade_providers_snapchat_check', 'blade_providers_tiktok_check');
-- La même garde est rejouée en tête de la transaction : l'application s'arrête d'elle-même si une
-- fonction a changé ou si la migration est déjà passée.
--
-- Retour arrière : 01_inscription_prestataire.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $g$
DECLARE bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blade_providers'
      AND column_name IN ('first_name', 'last_name', 'phone', 'instagram', 'snapchat', 'tiktok')) THEN
    RAISE EXCEPTION 'Migration annulée : une des colonnes existe déjà (migration déjà appliquée ?)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.blade_providers'::regclass
      AND conname IN ('blade_providers_first_name_check', 'blade_providers_last_name_check', 'blade_providers_phone_check', 'blade_providers_instagram_check', 'blade_providers_snapchat_check', 'blade_providers_tiktok_check')) THEN
    RAISE EXCEPTION 'Migration annulée : une des contraintes existe déjà';
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO bad FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.oid::regprocedure::text IN ('blade_register_provider(text)', 'blade_admin_overview()', 'blade_my_provider()')
    AND md5(pg_get_functiondef(p.oid)) <> CASE p.oid::regprocedure::text
      WHEN 'blade_register_provider(text)' THEN '83a268e4a877fc3a7e1c475c800d52cb'
      WHEN 'blade_admin_overview()' THEN '0cb6946eb85db05e12108c890b50014a'
      WHEN 'blade_my_provider()' THEN '0c4671e969ed431b0606ae202ae9c109' END;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Migration annulée : fonction(s) modifiée(s) depuis la préparation : %', bad; END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::text IN ('blade_register_provider(text)', 'blade_admin_overview()', 'blade_my_provider()')) <> 3 THEN
    RAISE EXCEPTION 'Migration annulée : une des trois fonctions attendues est absente';
  END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'blade_register_provider') <> 1 THEN
    RAISE EXCEPTION 'Migration annulée : une autre version de blade_register_provider existe déjà';
  END IF;
END $g$;

ALTER TABLE public.blade_providers
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN phone text,
  ADD COLUMN instagram text,
  ADD COLUMN snapchat text,
  ADD COLUMN tiktok text;

ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_first_name_check CHECK (first_name IS NULL OR (length(first_name) BETWEEN 1 AND 60 AND first_name = btrim(first_name) AND first_name !~ '[[:cntrl:]]'));
ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_last_name_check CHECK (last_name IS NULL OR (length(last_name) BETWEEN 1 AND 60 AND last_name = btrim(last_name) AND last_name !~ '[[:cntrl:]]'));
ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_phone_check CHECK (phone IS NULL OR (length(phone) BETWEEN 8 AND 20 AND phone ~ '^\+?[0-9][0-9 .-]*[0-9]$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 8 AND 15));
ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_instagram_check CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$');
ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_snapchat_check CHECK (snapchat IS NULL OR snapchat ~ '^[A-Za-z0-9._]{1,30}$');
ALTER TABLE public.blade_providers ADD CONSTRAINT blade_providers_tiktok_check CHECK (tiktok IS NULL OR tiktok ~ '^[A-Za-z0-9._]{1,30}$');

COMMENT ON COLUMN public.blade_providers.first_name IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';
COMMENT ON COLUMN public.blade_providers.last_name IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';
COMMENT ON COLUMN public.blade_providers.phone IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';
COMMENT ON COLUMN public.blade_providers.instagram IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';
COMMENT ON COLUMN public.blade_providers.snapchat IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';
COMMENT ON COLUMN public.blade_providers.tiktok IS 'Inscription prestataire (privé) : renvoyé seulement par blade_my_provider (le prestataire) et blade_admin_overview (superadmin).';

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
    'revolut_url', r.revolut_url, 'stripe_link_url', r.stripe_link_url, 'created_at', r.created_at,
    -- Coordonnées d'inscription : relues seulement par le prestataire lui-même (auth.uid()).
    'first_name', r.first_name, 'last_name', r.last_name, 'phone', r.phone,
    'instagram', r.instagram, 'snapchat', r.snapchat, 'tiktok', r.tiktok) END);
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
        -- Coordonnées d'inscription (superadmin seulement : contrôle is_superadmin ci-dessus).
        'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone,'instagram',p.instagram,'snapchat',p.snapchat,'tiktok',p.tiktok,
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

CREATE FUNCTION public.blade_register_provider(p_display_name text, p_first_name text, p_last_name text, p_phone text, p_instagram text DEFAULT NULL::text, p_snapchat text DEFAULT NULL::text, p_tiktok text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_email text;
  -- Espaces de début et de fin retirés, espaces multiples réduits à un seul.
  v_first text := NULLIF(regexp_replace(btrim(coalesce(p_first_name, '')), '\s+', ' ', 'g'), '');
  v_last text := NULLIF(regexp_replace(btrim(coalesce(p_last_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := NULLIF(regexp_replace(btrim(coalesce(p_phone, '')), '\s+', ' ', 'g'), '');
  -- Pseudos : tous les espaces et le ou les « @ » initiaux retirés.
  v_insta text := NULLIF(regexp_replace(regexp_replace(coalesce(p_instagram, ''), '\s', '', 'g'), '^@+', ''), '');
  v_snap text := NULLIF(regexp_replace(regexp_replace(coalesce(p_snapchat, ''), '\s', '', 'g'), '^@+', ''), '');
  v_tiktok text := NULLIF(regexp_replace(regexp_replace(coalesce(p_tiktok, ''), '\s', '', 'g'), '^@+', ''), '');
BEGIN
  -- Contrôles repris tels quels de blade_register_provider(text) : compte connecté, pas de doublon.
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF EXISTS(SELECT 1 FROM public.blade_providers WHERE user_id=auth.uid()) THEN RETURN public.blade_my_provider(); END IF;
  IF v_first IS NULL THEN RAISE EXCEPTION 'Prénom requis'; END IF;
  IF length(v_first) > 60 OR v_first ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Prénom invalide (60 caractères au plus)'; END IF;
  IF v_last IS NULL THEN RAISE EXCEPTION 'Nom requis'; END IF;
  IF length(v_last) > 60 OR v_last ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Nom invalide (60 caractères au plus)'; END IF;
  IF v_phone IS NULL THEN RAISE EXCEPTION 'Téléphone requis'; END IF;
  IF length(v_phone) NOT BETWEEN 8 AND 20 OR v_phone !~ '^\+?[0-9][0-9 .-]*[0-9]$'
     OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15 THEN
    RAISE EXCEPTION 'Téléphone invalide (chiffres, espaces, +, points ou tirets ; 8 à 20 caractères)';
  END IF;
  IF v_insta IS NOT NULL AND v_insta !~ '^[A-Za-z0-9._]{1,30}$' THEN RAISE EXCEPTION 'Pseudo Instagram invalide (lettres, chiffres, point ou tiret bas ; 30 caractères au plus)'; END IF;
  IF v_snap IS NOT NULL AND v_snap !~ '^[A-Za-z0-9._]{1,30}$' THEN RAISE EXCEPTION 'Pseudo Snapchat invalide (lettres, chiffres, point ou tiret bas ; 30 caractères au plus)'; END IF;
  IF v_tiktok IS NOT NULL AND v_tiktok !~ '^[A-Za-z0-9._]{1,30}$' THEN RAISE EXCEPTION 'Pseudo TikTok invalide (lettres, chiffres, point ou tiret bas ; 30 caractères au plus)'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.blade_providers(id,user_id,status,display_name,email,first_name,last_name,phone,instagram,snapchat,tiktok)
  VALUES (gen_random_uuid(), auth.uid(), 'pending', trim(p_display_name), lower(v_email), v_first, v_last, v_phone, v_insta, v_snap, v_tiktok);
  RETURN public.blade_my_provider();
END $function$;

REVOKE ALL ON FUNCTION public.blade_register_provider(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_register_provider(text, text, text, text, text, text, text) TO authenticated, service_role;

COMMIT;
