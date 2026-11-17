-- Réglage du logo par le prestataire : taille (zoom), centrage (position), remplissage et couleur de fond.
ALTER TABLE public.blade_provider_pages ADD COLUMN IF NOT EXISTS logo_style jsonb;

CREATE OR REPLACE FUNCTION public.blade_clean_logo_style(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p IS NULL OR jsonb_typeof(p) <> 'object' THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
    'zoom', LEAST(3, GREATEST(0.5, COALESCE(CASE WHEN jsonb_typeof(p->'zoom') = 'number' THEN (p->>'zoom')::numeric END, 1))),
    'x', LEAST(100, GREATEST(0, COALESCE(CASE WHEN jsonb_typeof(p->'x') = 'number' THEN (p->>'x')::numeric END, 50))),
    'y', LEAST(100, GREATEST(0, COALESCE(CASE WHEN jsonb_typeof(p->'y') = 'number' THEN (p->>'y')::numeric END, 50))),
    'fit', CASE WHEN p->>'fit' = 'contain' THEN 'contain' ELSE 'cover' END,
    'bg', CASE WHEN p->>'bg' ~ '^#[0-9A-Fa-f]{6}$' THEN p->>'bg' END
  )) END
$$;

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

-- Le repère de carte des salons reprend le logo avec son réglage.
CREATE OR REPLACE FUNCTION public.blade_public_salons()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'is_premium')::boolean DESC, x->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
      'lat', s.lat, 'lng', s.lng, 'specialties', s.specialties, 'price_from', s.price_from, 'cover_path', s.cover_path,
      'booking_platform', s.booking_platform, 'booking_url', s.booking_url,
      'logo_path', pg.logo_path, 'logo_style', pg.logo_style,
      'is_premium', public.blade_effective_plan(s.provider_id) = 'premium') AS x
    FROM public.blade_salons s LEFT JOIN public.blade_provider_pages pg ON pg.provider_id = s.provider_id
    WHERE public.blade_salon_is_public(s)
  ) t
$$;

CREATE OR REPLACE FUNCTION public.blade_salon_public(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
    'lat', s.lat, 'lng', s.lng, 'phone', s.phone, 'instagram', s.instagram, 'website', s.website, 'booking_url', s.booking_url,
    'booking_platform', s.booking_platform, 'specialties', s.specialties, 'description', s.description, 'price_from', s.price_from,
    'hours', s.hours, 'cover_path', s.cover_path, 'gallery_paths', s.gallery_paths,
    'logo_path', pg.logo_path, 'logo_style', pg.logo_style,
    'is_premium', public.blade_effective_plan(s.provider_id) = 'premium')
  FROM public.blade_salons s LEFT JOIN public.blade_provider_pages pg ON pg.provider_id = s.provider_id
  WHERE s.slug = p_slug AND public.blade_salon_is_public(s) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.blade_clean_logo_style(jsonb) FROM PUBLIC, anon;
