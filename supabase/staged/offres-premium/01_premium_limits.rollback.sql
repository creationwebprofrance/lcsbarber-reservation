-- Retour arrière de 01_premium_limits.sql : remet les six fonctions exactement telles qu'avant
-- (définitions pg_get_functiondef du 2026-11-25) et retire la RPC ajoutée blade_my_loyalty_usage().
-- Effets : fidélité de nouveau illimitée en Pro, modèles vitrine/salon de nouveau enregistrables et
-- affichés pour tous les plans, pourboires de nouveau ouverts au plan Pro. Aucune donnée n'est touchée
-- (cartes, modèles et liens enregistrés restent en place). CREATE OR REPLACE garde les GRANT.
-- Le site doit traiter une erreur sur blade_my_loyalty_usage comme « compteur indisponible ».
--
-- Contrôle préalable : doit renvoyer 0 ligne (les fonctions sont bien celles posées par la migration).
--   SELECT 'fonction modifiee : blade_loyalty_issue_card' FROM pg_proc WHERE oid = 'public.blade_loyalty_issue_card'::regproc AND md5(pg_get_functiondef(oid)) <> '35e8932a063cb27169282d42d7bced10'
--   UNION ALL SELECT 'fonction modifiee : blade_save_page' FROM pg_proc WHERE oid = 'public.blade_save_page'::regproc AND md5(pg_get_functiondef(oid)) <> '9f593d6db15cd2c3a2c253e73af7da0d'
--   UNION ALL SELECT 'fonction modifiee : blade_public_page' FROM pg_proc WHERE oid = 'public.blade_public_page'::regproc AND md5(pg_get_functiondef(oid)) <> 'fe2bf4ed7860751ecd786048b5c75428'
--   UNION ALL SELECT 'fonction modifiee : blade_set_tip_link' FROM pg_proc WHERE oid = 'public.blade_set_tip_link'::regproc AND md5(pg_get_functiondef(oid)) <> 'fd355051f072110a806311fd0b0e1a3d'
--   UNION ALL SELECT 'fonction modifiee : blade_my_tip_link' FROM pg_proc WHERE oid = 'public.blade_my_tip_link'::regproc AND md5(pg_get_functiondef(oid)) <> '467117cd9ed4ad460762fb24bb8ff6ac'
--   UNION ALL SELECT 'fonction modifiee : blade_my_tip_links' FROM pg_proc WHERE oid = 'public.blade_my_tip_links'::regproc AND md5(pg_get_functiondef(oid)) <> '29830a4496cbb084ccd1cecf3da8a931';
-- La même garde est rejouée en tête de la transaction.

BEGIN;

DO $g$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('blade_loyalty_issue_card', 'blade_save_page', 'blade_public_page', 'blade_set_tip_link', 'blade_my_tip_link', 'blade_my_tip_links')
    AND md5(pg_get_functiondef(p.oid)) <> CASE p.proname
      WHEN 'blade_loyalty_issue_card' THEN '35e8932a063cb27169282d42d7bced10'
      WHEN 'blade_save_page' THEN '9f593d6db15cd2c3a2c253e73af7da0d'
      WHEN 'blade_public_page' THEN 'fe2bf4ed7860751ecd786048b5c75428'
      WHEN 'blade_set_tip_link' THEN 'fd355051f072110a806311fd0b0e1a3d'
      WHEN 'blade_my_tip_link' THEN '467117cd9ed4ad460762fb24bb8ff6ac'
      WHEN 'blade_my_tip_links' THEN '29830a4496cbb084ccd1cecf3da8a931' END;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Retour arrière annulé : fonction(s) modifiée(s) depuis la préparation : %', bad; END IF;
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
DECLARE pid uuid := COALESCE(p_provider, public.blade_lcs_provider_id()); pr record; pg jsonb; is_lcs boolean;
BEGIN
  SELECT id, display_name INTO pr FROM public.blade_providers WHERE id = pid AND status = 'active';
  IF pr.id IS NULL THEN RETURN NULL; END IF;
  is_lcs := pid = public.blade_lcs_provider_id();
  SELECT to_jsonb(p) - 'provider_id' INTO pg FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN jsonb_build_object(
    'provider_id', pid, 'name', COALESCE(pr.display_name, 'Professionnel'), 'is_lcs', is_lcs, 'page', pg,
    'is_premium', public.blade_effective_plan(pid) = 'premium',
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
    IF public.blade_effective_plan(r.id) = 'free' THEN
      RAISE EXCEPTION 'Les pourboires sont inclus dans le plan Pro';
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
  RETURN jsonb_build_object('tip_url', r.tip_url, 'allowed', public.blade_effective_plan(r.id) <> 'free');
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
        AND public.blade_effective_plan(p.id) <> 'free'
      ORDER BY b.appointment_date DESC, b.appointment_time DESC NULLS LAST
      LIMIT 20
    ) x
  ), '[]'::jsonb);
END $function$;

DROP FUNCTION IF EXISTS public.blade_my_loyalty_usage();

COMMIT;
