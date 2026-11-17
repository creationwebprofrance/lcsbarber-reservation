-- Vitrine de la page d'accueil : photos et vidéos publiées par les prestataires actifs, avec leur nom.
-- Les vidéos sont acceptées dans la galerie (50 Mo maximum par fichier).
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'blade-provider-media';

CREATE OR REPLACE FUNCTION public.blade_public_showcase()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY ord, rnd), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('provider_id', p.id, 'name', COALESCE(p.display_name, 'Professionnel'), 'path', m.path,
      'kind', CASE WHEN m.path ~* '\.(mp4|webm|mov)$' THEN 'video' ELSE 'image' END) AS x,
      m.ord, random() AS rnd
    FROM public.blade_providers p
    JOIN public.blade_provider_pages pg ON pg.provider_id = p.id
    CROSS JOIN LATERAL (
      SELECT g.path, g.ord FROM unnest(pg.gallery_paths) WITH ORDINALITY AS g(path, ord)
      UNION ALL SELECT pg.cover_path, 100 WHERE pg.cover_path IS NOT NULL
    ) m
    WHERE p.status = 'active' AND m.path IS NOT NULL
    LIMIT 24
  ) t
$$;
REVOKE ALL ON FUNCTION public.blade_public_showcase() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_public_showcase() TO anon, authenticated;
