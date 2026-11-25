-- Retour arrière de 01_page_layout.sql : remet blade_validate_page() et blade_save_page(jsonb)
-- exactement telles qu'avant (définitions du 2026-11-25), puis met la colonne layout hors service.
--
-- ATTENTION : les choix de modèle cessent de s'appliquer : toutes les
-- pages reviennent au modèle classique (src/blade/customization-model.ts, layoutOf, renvoie
-- 'classique' quand la clé manque).
-- Règle de Dédale (jamais de DROP COLUMN) : la colonne n'est PAS supprimée mais renommée
-- layout_retire ; elle n'est plus lue ni écrite par aucune fonction, et les anciens choix restent
-- récupérables (renommer en layout puis réappliquer les fonctions de 01_page_layout.sql).
-- Conséquence : blade_public_page et blade_save_page renverront aussi la clé « layout_retire »
-- (valeur publique et sans donnée personnelle, ignorée par l'interface). Une suppression définitive
-- (DROP COLUMN, irréversible) est une décision séparée de l'utilisateur, non préparée ici.
-- Les GRANT ne changent pas (CREATE OR REPLACE les conserve).

BEGIN;

CREATE OR REPLACE FUNCTION public.blade_validate_page()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE q jsonb; o jsonb; s text; ids text[] := ARRAY[]::text[]; prefix text := NEW.provider_id::text || '/';
BEGIN
  IF NEW.accent_color !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'Couleur invalide'; END IF;
  IF NEW.font_key NOT IN ('classique','elegante','moderne','urbaine','douce') THEN RAISE EXCEPTION 'Police invalide'; END IF;
  IF NEW.booking_modes NOT IN ('both','domicile','deplacement') THEN RAISE EXCEPTION 'Lieux proposés invalides'; END IF;
  IF NEW.step_order NOT IN ('service','place','date') THEN RAISE EXCEPTION 'Ordre des étapes invalide'; END IF;
  NEW.bio := NULLIF(trim(NEW.bio), ''); NEW.city := NULLIF(trim(NEW.city), ''); NEW.salon_address := NULLIF(trim(NEW.salon_address), '');
  NEW.instagram := NULLIF(trim(both '@ ' from coalesce(NEW.instagram, '')), ''); NEW.tiktok := NULLIF(trim(both '@ ' from coalesce(NEW.tiktok, '')), '');
  NEW.welcome_message := NULLIF(trim(NEW.welcome_message), ''); NEW.booking_rules := NULLIF(trim(NEW.booking_rules), '');
  NEW.logo_path := NULLIF(NEW.logo_path, ''); NEW.cover_path := NULLIF(NEW.cover_path, '');
  IF length(NEW.bio) > 1000 THEN RAISE EXCEPTION 'Présentation trop longue (1000 caractères max)'; END IF;
  IF length(NEW.city) > 80 THEN RAISE EXCEPTION 'Ville trop longue'; END IF;
  IF length(NEW.salon_address) > 200 THEN RAISE EXCEPTION 'Adresse trop longue'; END IF;
  IF length(NEW.welcome_message) > 600 THEN RAISE EXCEPTION 'Message d’accueil trop long (600 caractères max)'; END IF;
  IF length(NEW.booking_rules) > 1500 THEN RAISE EXCEPTION 'Conditions trop longues (1500 caractères max)'; END IF;
  IF NEW.instagram IS NOT NULL AND NEW.instagram !~ '^[A-Za-z0-9._]{1,30}$' THEN RAISE EXCEPTION 'Nom Instagram invalide'; END IF;
  IF NEW.tiktok IS NOT NULL AND NEW.tiktok !~ '^[A-Za-z0-9._]{2,24}$' THEN RAISE EXCEPTION 'Nom TikTok invalide'; END IF;
  IF NEW.logo_path IS NOT NULL AND (left(NEW.logo_path, length(prefix)) <> prefix OR length(NEW.logo_path) > 200) THEN RAISE EXCEPTION 'Logo invalide'; END IF;
  IF NEW.cover_path IS NOT NULL AND (left(NEW.cover_path, length(prefix)) <> prefix OR length(NEW.cover_path) > 200) THEN RAISE EXCEPTION 'Couverture invalide'; END IF;
  IF cardinality(NEW.gallery_paths) > 12 THEN RAISE EXCEPTION 'Galerie limitée à 12 photos'; END IF;
  FOREACH s IN ARRAY NEW.gallery_paths LOOP
    IF s IS NULL OR left(s, length(prefix)) <> prefix OR length(s) > 200 THEN RAISE EXCEPTION 'Photo de galerie invalide'; END IF;
  END LOOP;
  IF cardinality(NEW.sections) > 5
     OR EXISTS(SELECT 1 FROM unnest(NEW.sections) x WHERE x IS NULL OR x NOT IN ('services','gallery','reviews','hours','map'))
     OR (SELECT count(DISTINCT x) FROM unnest(NEW.sections) x) <> cardinality(NEW.sections) THEN
    RAISE EXCEPTION 'Sections invalides';
  END IF;
  IF jsonb_typeof(NEW.custom_questions) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.custom_questions) > 5 THEN RAISE EXCEPTION '5 questions maximum'; END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(NEW.custom_questions) LOOP
    IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR coalesce(q->>'id', '') !~ '^[a-z0-9-]{1,40}$' OR (q->>'id') = ANY(ids) THEN RAISE EXCEPTION 'Question invalide'; END IF;
    ids := ids || (q->>'id');
    IF length(trim(coalesce(q->>'label', ''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Intitulé de question invalide (2 à 120 caractères)'; END IF;
    IF coalesce(q->>'type', '') NOT IN ('text','choice','yesno') THEN RAISE EXCEPTION 'Type de question invalide'; END IF;
    IF jsonb_typeof(q->'required') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Question invalide'; END IF;
    IF q->>'type' = 'choice' THEN
      IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'options') NOT BETWEEN 2 AND 8 THEN RAISE EXCEPTION 'Une question à choix doit proposer 2 à 8 réponses'; END IF;
      FOR o IN SELECT * FROM jsonb_array_elements(q->'options') LOOP
        IF jsonb_typeof(o) IS DISTINCT FROM 'string' OR length(trim(o #>> '{}')) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Réponse proposée invalide (1 à 60 caractères)'; END IF;
      END LOOP;
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
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
    custom_questions = CASE WHEN p_values ? 'custom_questions' THEN p_values->'custom_questions' ELSE custom_questions END,
    widgets = CASE WHEN p_values ? 'widgets' THEN public.blade_clean_widgets(p_values->'widgets') ELSE widgets END,
    logo_style = CASE WHEN p_values ? 'logo_style' THEN public.blade_clean_logo_style(p_values->'logo_style') ELSE logo_style END
  WHERE provider_id = pid;
  SELECT to_jsonb(p) INTO out FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN out;
END $function$;

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'blade_provider_pages' AND column_name = 'layout_retire') THEN
    RAISE EXCEPTION 'layout_retire existe deja : retour arriere a faire a la main';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'blade_provider_pages' AND column_name = 'layout') THEN
    ALTER TABLE public.blade_provider_pages RENAME COLUMN layout TO layout_retire;
  END IF;
END
$rb$;

COMMIT;
