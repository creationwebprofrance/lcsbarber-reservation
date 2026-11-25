-- Profil · modèle de page au choix du prestataire (classique, agenda, vitrine, salon).
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : chaque prestataire choisit la mise en page de son profil public. Le choix est stocké
--   dans public.blade_provider_pages.layout, écrit seulement par blade_save_page (comme le reste de
--   la page) et validé par le trigger blade_validate_page.
-- Ce que fait le fichier :
--   1. ajoute la colonne layout text NOT NULL DEFAULT 'classique' (additive ; les lignes existantes
--      prennent 'classique', leur affichage ne change pas ; ajout sans réécriture de la table, PG 17).
--   2. blade_validate_page() : reprise intégrale de la définition actuelle (pg_get_functiondef),
--      avec UNE ligne ajoutée après le contrôle de step_order : refus de toute valeur hors de
--      ('classique','agenda','vitrine','salon'), message « Modèle de page invalide ».
--      Choix du trigger plutôt que d'une contrainte CHECK : toutes les autres valeurs énumérées de la
--      table (font_key, booking_modes, step_order) y sont déjà validées, et le trigger renvoie un
--      message en français que l'interface affiche tel quel (une CHECK renverrait « violates check
--      constraint … »). Le trigger est BEFORE INSERT OR UPDATE : il couvre tous les chemins d'écriture.
--      NULL est refusé par NOT NULL.
--   3. blade_save_page(jsonb) : reprise intégrale, avec UNE ligne ajoutée dans l'UPDATE :
--      layout = COALESCE(p_values->>'layout', layout). SECURITY DEFINER et search_path = public
--      inchangés ; CREATE OR REPLACE conserve le propriétaire et les GRANT (EXECUTE : postgres,
--      authenticated, service_role ; pas anon, pas PUBLIC).
--   4. blade_public_page(uuid) n'est pas modifiée : elle renvoie to_jsonb(p) - 'provider_id', donc la
--      clé « layout » y apparaît d'elle-même.
-- Risques :
--   - ALTER TABLE prend un court verrou exclusif sur blade_provider_pages (ajout de colonne à défaut
--     constant : métadonnées seulement, instantané).
--   - Le modèle choisi est public (lisible par anon via la politique « Active provider pages are
--     public » et blade_public_page), comme la couleur et la police : aucune donnée personnelle.
-- Contrôle préalable : doit renvoyer 0 ligne. Il vérifie que la colonne n'existe pas encore et que
-- les trois fonctions sont exactement celles reprises ici (empreintes md5 du 2026-11-25) ; sinon,
-- ne pas appliquer et faire reprendre les définitions par Dédale.
--
--   SELECT 'colonne layout deja presente' AS probleme
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'blade_provider_pages' AND column_name = 'layout'
--   UNION ALL
--   SELECT 'fonction modifiee depuis la preparation : ' || p.proname
--   FROM pg_proc p
--   WHERE p.pronamespace = 'public'::regnamespace
--     AND p.proname IN ('blade_validate_page', 'blade_save_page', 'blade_public_page')
--     AND md5(pg_get_functiondef(p.oid)) NOT IN ('7d25bbe3ce482e89e7b6e382c3055c4b',
--                                                'e68b975909760b42f36b72a15fd026f6',
--                                                'a9ca83855e263897e4d2ae73c9773622');
--
-- Retour arrière : 01_page_layout.rollback.sql

BEGIN;

ALTER TABLE public.blade_provider_pages
  ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'classique';

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
  IF NEW.layout NOT IN ('classique','agenda','vitrine','salon') THEN RAISE EXCEPTION 'Modèle de page invalide'; END IF;
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
    layout = COALESCE(p_values->>'layout', layout),
    custom_questions = CASE WHEN p_values ? 'custom_questions' THEN p_values->'custom_questions' ELSE custom_questions END,
    widgets = CASE WHEN p_values ? 'widgets' THEN public.blade_clean_widgets(p_values->'widgets') ELSE widgets END,
    logo_style = CASE WHEN p_values ? 'logo_style' THEN public.blade_clean_logo_style(p_values->'logo_style') ELSE logo_style END
  WHERE provider_id = pid;
  SELECT to_jsonb(p) INTO out FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN out;
END $function$;

COMMIT;
