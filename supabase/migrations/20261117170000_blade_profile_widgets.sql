-- Profil en widgets : chaque bloc du profil public (présentation, prestations, galerie, texte libre…)
-- peut être ajouté, retiré, déplacé et affiché en pleine largeur ou en demi-largeur.
ALTER TABLE public.blade_provider_pages ADD COLUMN IF NOT EXISTS widgets jsonb;

-- Validation côté serveur : le navigateur ne décide jamais de la forme stockée.
CREATE OR REPLACE FUNCTION public.blade_clean_widgets(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE w jsonb; out jsonb := '[]'::jsonb; n int := 0; t text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN NULL; END IF;
  FOR w IN SELECT * FROM jsonb_array_elements(p) LOOP
    EXIT WHEN n >= 16;
    t := w->>'type';
    CONTINUE WHEN jsonb_typeof(w) <> 'object' OR t IS NULL OR t NOT IN ('about','social','services','gallery','reviews','hours','map','booking','text');
    -- un seul exemplaire de chaque bloc, sauf le texte libre
    CONTINUE WHEN t <> 'text' AND EXISTS (SELECT 1 FROM jsonb_array_elements(out) e WHERE e->>'type' = t);
    out := out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', left(COALESCE(NULLIF(regexp_replace(w->>'id', '[^A-Za-z0-9_-]', '', 'g'), ''), t || '-' || n), 40),
      'type', t,
      'size', CASE WHEN w->>'size' = 'half' THEN 'half' ELSE 'full' END,
      'title', NULLIF(left(btrim(COALESCE(w->>'title', '')), 60), ''),
      'text', CASE WHEN t = 'text' THEN NULLIF(left(btrim(COALESCE(w->>'text', '')), 1200), '') END
    )));
    n := n + 1;
  END LOOP;
  RETURN out;
END $$;

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
    widgets = CASE WHEN p_values ? 'widgets' THEN public.blade_clean_widgets(p_values->'widgets') ELSE widgets END
  WHERE provider_id = pid;
  SELECT to_jsonb(p) INTO out FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN out;
END $function$;

-- Le logo du prestataire sert de repère sur la carte des salons.
CREATE OR REPLACE FUNCTION public.blade_public_salons()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'is_premium')::boolean DESC, x->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
      'lat', s.lat, 'lng', s.lng, 'specialties', s.specialties, 'price_from', s.price_from, 'cover_path', s.cover_path,
      'booking_platform', s.booking_platform, 'booking_url', s.booking_url,
      'logo_path', (SELECT pg.logo_path FROM public.blade_provider_pages pg WHERE pg.provider_id = s.provider_id),
      'is_premium', public.blade_effective_plan(s.provider_id) = 'premium') AS x
    FROM public.blade_salons s WHERE public.blade_salon_is_public(s)
  ) t
$$;

CREATE OR REPLACE FUNCTION public.blade_salon_public(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
    'lat', s.lat, 'lng', s.lng, 'phone', s.phone, 'instagram', s.instagram, 'website', s.website, 'booking_url', s.booking_url,
    'booking_platform', s.booking_platform, 'specialties', s.specialties, 'description', s.description, 'price_from', s.price_from,
    'hours', s.hours, 'cover_path', s.cover_path, 'gallery_paths', s.gallery_paths,
    'logo_path', (SELECT pg.logo_path FROM public.blade_provider_pages pg WHERE pg.provider_id = s.provider_id),
    'is_premium', public.blade_effective_plan(s.provider_id) = 'premium')
  FROM public.blade_salons s WHERE s.slug = p_slug AND public.blade_salon_is_public(s) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.blade_clean_widgets(jsonb) FROM PUBLIC, anon;
