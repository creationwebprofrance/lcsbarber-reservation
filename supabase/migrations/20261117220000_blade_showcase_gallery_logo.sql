-- Vitrine de l'accueil : uniquement les photos de galerie des pros actifs, avec leur logo et son réglage.
CREATE OR REPLACE FUNCTION public.blade_public_showcase()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY ord, rnd), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('provider_id', p.id, 'name', COALESCE(p.display_name, 'Professionnel'), 'path', g.path,
      'kind', CASE WHEN g.path ~* '\.(mp4|webm|mov)$' THEN 'video' ELSE 'image' END,
      'logo_path', pg.logo_path, 'logo_style', pg.logo_style) AS x,
      g.ord, random() AS rnd
    FROM public.blade_providers p
    JOIN public.blade_provider_pages pg ON pg.provider_id = p.id
    CROSS JOIN LATERAL unnest(pg.gallery_paths) WITH ORDINALITY AS g(path, ord)
    WHERE p.status = 'active' AND g.path IS NOT NULL
    LIMIT 24
  ) t
$$;
REVOKE ALL ON FUNCTION public.blade_public_showcase() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_public_showcase() TO anon, authenticated;
