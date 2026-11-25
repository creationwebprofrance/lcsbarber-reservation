-- Offres : fonctions intéressantes en Premium complet, extrait pour le plan Pro.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Le plan se lit toujours avec public.blade_effective_plan(provider_id) ('free' | 'pro' | 'premium' ;
-- superadmin = premium). Chaque fonction est reprise intégralement de pg_get_functiondef (2026-11-25) et
-- seules les lignes citées changent. CREATE OR REPLACE garde propriétaire, SECURITY DEFINER,
-- search_path = public et GRANT (EXECUTE : postgres, authenticated, service_role ; blade_public_page
-- aussi anon et PUBLIC, comme avant).
--
-- 1. Fidélité. Seul blade_loyalty_issue_card crée une carte (RLS de blade_loyalty_cards : lecture seule,
--    aucune politique d'écriture ; blade-notify ne fait qu'un UPDATE de sent_at). Plan Pro : refus d'une
--    51e carte (« Le plan Pro inclut la fidélité pour 50 clients. Passe au plan Premium pour des cartes
--    illimitées. »). Réémettre la carte d'un client qui en a déjà une (ON CONFLICT sur l'e-mail) reste
--    permis au-delà de 50 ; blade_loyalty_add, blade_loyalty_redeem et blade_loyalty_find ne changent
--    pas : les cartes existantes continuent de fonctionner, aucune n'est supprimée. Un verrou
--    pg_advisory_xact_lock par prestataire (plan Pro seulement) empêche deux créations simultanées de
--    dépasser 50. Free : refus déjà en place, inchangé.
--    Compteur : NOUVELLE RPC blade_my_loyalty_usage() -> {"used": <int>, "limit": 50 | null | 0}
--    (null = Premium illimité, 0 = Découverte). Choisie plutôt qu'une modification de blade_my_plan :
--    blade_my_plan est lu par chaque écran (PlanGate, bandeau) ; une nouvelle fonction ne peut rien
--    casser d'existant et son retour arrière est un simple DROP FUNCTION.
-- 2. Modèles de page. blade_save_page refuse 'vitrine' et 'salon' hors Premium (« Les modèles Vitrine et
--    Salon sont inclus dans le plan Premium. »), SEULEMENT si le modèle demandé diffère du modèle
--    enregistré : un prestataire redescendu en Pro qui réenregistre sa page sans toucher au modèle garde
--    sa donnée et ses autres champs s'enregistrent. blade_public_page renvoie layout = 'classique' aux
--    visiteurs quand le modèle enregistré est vitrine/salon et le plan non premium, sans réécrire la
--    ligne ; le propriétaire (blade_my_provider_id() = provider) reçoit la vraie valeur, sinon son
--    éditeur (customize.tsx lit blade_public_page puis renvoie tout le brouillon) écraserait vitrine par
--    classique et le passage en Premium ne la rétablirait plus. Nouvelle clé de premier niveau
--    'layout_locked' (boolean) : true quand le modèle enregistré est masqué par le plan. blade_validate_page
--    n'est pas modifiée (les 4 valeurs restent valides).
-- 3. Pourboires : Premium seulement. blade_set_tip_link (enregistrer un lien : plan premium, « Les
--    pourboires sont inclus dans le plan Premium » ; vider reste toujours permis), blade_my_tip_link
--    (allowed = plan premium), blade_my_tip_links (prestataires premium seulement).
--
-- Risques :
--   - Un Pro qui avait un tip_url le garde en base mais ses clients ne le voient plus (aujourd'hui :
--     aucun prestataire n'a de tip_url, aucune page en vitrine/salon, aucune carte de fidélité).
--   - La table blade_provider_pages reste lisible en direct par anon (politique « Active provider pages
--     are public ») : la vraie valeur de layout y reste visible. Ce n'est pas une donnée sensible ; le site
--     ne lit que blade_public_page.
--   - ?modele=vitrine reste un aperçu côté navigateur pour tous (jamais enregistré).
--
-- Contrôle préalable : doit renvoyer 0 ligne (sinon, ne pas appliquer et faire reprendre par Dédale).
--   SELECT 'fonction modifiee : blade_loyalty_issue_card' FROM pg_proc WHERE oid = 'public.blade_loyalty_issue_card'::regproc AND md5(pg_get_functiondef(oid)) <> '8481465f2990bff91dc479ed49c6af5c'
--   UNION ALL SELECT 'fonction modifiee : blade_save_page' FROM pg_proc WHERE oid = 'public.blade_save_page'::regproc AND md5(pg_get_functiondef(oid)) <> 'f51590220e2bce3eab589c2dba40e724'
--   UNION ALL SELECT 'fonction modifiee : blade_public_page' FROM pg_proc WHERE oid = 'public.blade_public_page'::regproc AND md5(pg_get_functiondef(oid)) <> '7d25bbe3ce482e89e7b6e382c3055c4b'
--   UNION ALL SELECT 'fonction modifiee : blade_set_tip_link' FROM pg_proc WHERE oid = 'public.blade_set_tip_link'::regproc AND md5(pg_get_functiondef(oid)) <> '944d17de46b1b16fe33941554a3b4040'
--   UNION ALL SELECT 'fonction modifiee : blade_my_tip_link' FROM pg_proc WHERE oid = 'public.blade_my_tip_link'::regproc AND md5(pg_get_functiondef(oid)) <> '7a47649f5b4582e9e2a84e7540fee722'
--   UNION ALL SELECT 'fonction modifiee : blade_my_tip_links' FROM pg_proc WHERE oid = 'public.blade_my_tip_links'::regproc AND md5(pg_get_functiondef(oid)) <> '2d1af193b7d41076e50bff95ad98a6ff'
--   UNION ALL SELECT 'blade_my_loyalty_usage existe deja' FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'blade_my_loyalty_usage';
-- La même garde md5 est rejouée en tête de la transaction : l'application s'arrête d'elle-même si une
-- fonction a changé.
--
-- Retour arrière : 01_premium_limits.rollback.sql

BEGIN;

DO $g$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('blade_loyalty_issue_card', 'blade_save_page', 'blade_public_page', 'blade_set_tip_link', 'blade_my_tip_link', 'blade_my_tip_links')
    AND md5(pg_get_functiondef(p.oid)) <> CASE p.proname
      WHEN 'blade_loyalty_issue_card' THEN '8481465f2990bff91dc479ed49c6af5c'
      WHEN 'blade_save_page' THEN 'f51590220e2bce3eab589c2dba40e724'
      WHEN 'blade_public_page' THEN '7d25bbe3ce482e89e7b6e382c3055c4b'
      WHEN 'blade_set_tip_link' THEN '944d17de46b1b16fe33941554a3b4040'
      WHEN 'blade_my_tip_link' THEN '7a47649f5b4582e9e2a84e7540fee722'
      WHEN 'blade_my_tip_links' THEN '2d1af193b7d41076e50bff95ad98a6ff' END;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Migration annulée : fonction(s) modifiée(s) depuis la préparation : %', bad; END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('blade_loyalty_issue_card', 'blade_save_page', 'blade_public_page', 'blade_set_tip_link', 'blade_my_tip_link', 'blade_my_tip_links')) <> 6 THEN
    RAISE EXCEPTION 'Migration annulée : une des six fonctions attendues est absente ou en double';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'blade_my_loyalty_usage') THEN
    RAISE EXCEPTION 'Migration annulée : blade_my_loyalty_usage existe déjà';
  END IF;
END $g$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_issue_card(p_email text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); v_email text := lower(trim(coalesce(p_email, ''))); v_name text := trim(coalesce(p_name, '')); cid uuid;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF public.blade_effective_plan(pid) = 'free' THEN RAISE EXCEPTION 'La carte de fidélité est incluse dans le plan Pro.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.blade_loyalty_programs WHERE provider_id = pid AND active) THEN RAISE EXCEPTION 'Active d’abord ta carte fidélité'; END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Adresse email invalide'; END IF;
  IF length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nom du client invalide (2 à 100 caractères)'; END IF;
  -- Plan Pro : cartes pour 50 clients au plus (Premium : illimité). Un client qui a déjà sa carte la garde.
  IF public.blade_effective_plan(pid) = 'pro' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('blade_loyalty_cards:' || pid::text, 0));
    IF NOT EXISTS(SELECT 1 FROM public.blade_loyalty_cards WHERE provider_id = pid AND client_email = v_email)
       AND (SELECT count(*) FROM public.blade_loyalty_cards WHERE provider_id = pid) >= 50 THEN
      RAISE EXCEPTION 'Le plan Pro inclut la fidélité pour 50 clients. Passe au plan Premium pour des cartes illimitées.';
    END IF;
  END IF;
  INSERT INTO public.blade_loyalty_cards(provider_id, client_email, client_name) VALUES (pid, v_email, v_name)
  ON CONFLICT (provider_id, client_email) DO UPDATE SET client_name = EXCLUDED.client_name, updated_at = now()
  RETURNING id INTO cid;
  RETURN public.blade_loyalty_card_json(cid, true);
END $function$;

CREATE OR REPLACE FUNCTION public.blade_save_page(p_values jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); out jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Données invalides'; END IF;
  INSERT INTO public.blade_provider_pages(provider_id) VALUES (pid) ON CONFLICT (provider_id) DO NOTHING;
  -- Modèles Vitrine et Salon : plan Premium. Le modèle déjà enregistré reste accepté tel quel, pour que les autres champs s'enregistrent.
  IF p_values->>'layout' IN ('vitrine','salon')
     AND p_values->>'layout' IS DISTINCT FROM (SELECT layout FROM public.blade_provider_pages WHERE provider_id = pid)
     AND public.blade_effective_plan(pid) <> 'premium' THEN
    RAISE EXCEPTION 'Les modèles Vitrine et Salon sont inclus dans le plan Premium.';
  END IF;
  UPDATE public.blade_provider_pages SET
    accent_color = COALESCE(p_values->>'accent_color', accent_color),
    font_key = COALESCE(p_values->>'font_key', font_key),
    logo_path = CASE WHEN p_values ? 'logo_path' THEN p_values->>'logo_path' ELSE logo_path END,
    cover_path = CASE WHEN p_values ? 'cover_path' THEN p_values->>'cover_path' ELSE cover_path END,
    bio = CASE WHEN p_values ? 'bio' THEN p_values->>'bio' ELSE bio END,
    city = CASE WHEN p_values ? 'city' THEN p_values->>'city' ELSE city END,
    salon_address = CASE WHEN p_values ? 'salon_address' THEN p_values->>'salon_address' ELSE salon_address END,
    instagram = CASE WHEN p_values ? 'instagram' THEN p_values->>'instagram' ELSE instagram END,
    tiktok = CASE WHEN p_values ? 'tiktok' THEN p_values->>'tiktok' ELSE tiktok END,
    welcome_message = CASE WHEN p_values ? 'welcome_message' THEN p_values->>'welcome_message' ELSE welcome_message END,
    booking_rules = CASE WHEN p_values ? 'booking_rules' THEN p_values->>'booking_rules' ELSE booking_rules END,
    sections = CASE WHEN jsonb_typeof(p_values->'sections') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p_values->'sections')) ELSE sections END,
    gallery_paths = CASE WHEN jsonb_typeof(p_values->'gallery_paths') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p_values->'gallery_paths')) ELSE gallery_paths END,
    booking_modes = COALESCE(p_values->>'booking_modes', booking_modes),
    step_order = COALESCE(p_values->>'step_order', step_order),
    layout = COALESCE(p_values->>'layout', layout),
    custom_questions = CASE WHEN p_values ? 'custom_questions' THEN p_values->'custom_questions' ELSE custom_questions END,
    widgets = CASE WHEN p_values ? 'widgets' THEN public.blade_clean_widgets(p_values->'widgets') ELSE widgets END,
    logo_style = CASE WHEN p_values ? 'logo_style' THEN public.blade_clean_logo_style(p_values->'logo_style') ELSE logo_style END
  WHERE provider_id = pid;
  SELECT to_jsonb(p) INTO out FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN out;
END $function$;

CREATE OR REPLACE FUNCTION public.blade_public_page(p_provider uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := COALESCE(p_provider, public.blade_lcs_provider_id()); pr record; pg jsonb; is_lcs boolean; v_locked boolean;
BEGIN
  SELECT id, display_name INTO pr FROM public.blade_providers WHERE id = pid AND status = 'active';
  IF pr.id IS NULL THEN RETURN NULL; END IF;
  is_lcs := pid = public.blade_lcs_provider_id();
  SELECT to_jsonb(p) - 'provider_id' INTO pg FROM public.blade_provider_pages p WHERE provider_id = pid;
  -- Vitrine et Salon : plan Premium. Sinon les visiteurs voient le modèle classique, sans réécrire la donnée ;
  -- le propriétaire garde la vraie valeur (son éditeur la renvoie telle quelle et ne l'efface pas).
  v_locked := COALESCE(pg->>'layout' IN ('vitrine','salon') AND public.blade_effective_plan(pid) <> 'premium', false);
  IF v_locked AND pid IS DISTINCT FROM public.blade_my_provider_id() THEN pg := jsonb_set(pg, '{layout}', '"classique"'); END IF;
  RETURN jsonb_build_object(
    'provider_id', pid, 'name', COALESCE(pr.display_name, 'Professionnel'), 'is_lcs', is_lcs, 'page', pg,
    'is_premium', public.blade_effective_plan(pid) = 'premium', 'layout_locked', v_locked,
    'services', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'price', s.price, 'duration_minutes', s.duration_minutes) ORDER BY s.price)
                 FROM public.services s WHERE s.provider_id = pid AND s.is_active), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(t.x ORDER BY t.created_at DESC) FROM (
                 SELECT r.created_at, jsonb_build_object('id', r.id, 'client_name', r.client_name, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) AS x
                 FROM public.reviews r LEFT JOIN public.bookings b ON b.id = r.booking_id
                 WHERE b.provider_id = pid OR (r.booking_id IS NULL AND is_lcs) ORDER BY r.created_at DESC LIMIT 30) t), '[]'::jsonb),
    'hours', CASE WHEN is_lcs THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('day_of_week', c.day_of_week, 'start_time', c.start_time, 'end_time', c.end_time, 'mode', c.mode) ORDER BY c.day_of_week, c.start_time)
                 FROM public.calendar_settings c WHERE c.is_available), '[]'::jsonb) ELSE '[]'::jsonb END);
END $function$;

CREATE OR REPLACE FUNCTION public.blade_set_tip_link(p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT p.id, p.status INTO r FROM public.blade_providers p WHERE p.user_id = auth.uid();
  END IF;
  IF r.id IS NULL OR r.status <> 'active' THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  v := NULLIF(btrim(COALESCE(p_url, ''), E' \t\r\n'), '');
  IF v IS NOT NULL THEN
    IF public.blade_effective_plan(r.id) <> 'premium' THEN
      RAISE EXCEPTION 'Les pourboires sont inclus dans le plan Premium';
    END IF;
    IF length(v) > 200
       OR (v !~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$'
           AND v !~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$') THEN
      RAISE EXCEPTION 'Lien invalide : il doit commencer par https://revolut.me/ ou https://buy.stripe.com/';
    END IF;
  END IF;
  BEGIN
    UPDATE public.blade_providers SET tip_url = v WHERE id = r.id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Lien invalide : il doit commencer par https://revolut.me/ ou https://buy.stripe.com/';
  END;
  RETURN public.blade_my_tip_link();
END $function$;

CREATE OR REPLACE FUNCTION public.blade_my_tip_link()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT p.id, p.tip_url INTO r FROM public.blade_providers p WHERE p.user_id = auth.uid();
  IF r.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('tip_url', r.tip_url, 'allowed', public.blade_effective_plan(r.id) = 'premium');
END $function$;

CREATE OR REPLACE FUNCTION public.blade_my_tip_links()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(NULLIF(btrim(auth.email()), ''));
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x.item ORDER BY x.d DESC, x.t DESC NULLS LAST)
    FROM (
      SELECT b.appointment_date AS d, b.appointment_time AS t,
             jsonb_build_object(
               'booking_id', b.id,
               'appointment_date', b.appointment_date,
               'provider_name', p.display_name,
               'service_name', s.name,
               'tip_url', p.tip_url) AS item
      FROM public.bookings b
      JOIN public.blade_providers p ON p.id = b.provider_id
      LEFT JOIN public.services s ON s.id = b.service_id
      WHERE lower(b.client_email) = v_email
        AND b.status IN ('confirmed', 'completed')
        AND b.appointment_date BETWEEN v_today - 30 AND v_today
        -- Le jour même, seulement une fois l'heure du rendez-vous passée (heure de Paris).
        AND (b.appointment_date < v_today OR b.appointment_time <= (now() AT TIME ZONE 'Europe/Paris')::time)
        AND p.status = 'active'
        AND p.tip_url IS NOT NULL
        AND public.blade_effective_plan(p.id) = 'premium'
      ORDER BY b.appointment_date DESC, b.appointment_time DESC NULLS LAST
      LIMIT 20
    ) x
  ), '[]'::jsonb);
END $function$;

CREATE OR REPLACE FUNCTION public.blade_my_loyalty_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); v_plan text;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif' USING ERRCODE = '42501'; END IF;
  v_plan := public.blade_effective_plan(pid);
  RETURN jsonb_build_object(
    'used', (SELECT count(*) FROM public.blade_loyalty_cards WHERE provider_id = pid),
    'limit', CASE v_plan WHEN 'premium' THEN NULL WHEN 'pro' THEN 50 ELSE 0 END);
END $function$;

REVOKE ALL ON FUNCTION public.blade_my_loyalty_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_my_loyalty_usage() TO authenticated, service_role;

COMMIT;
