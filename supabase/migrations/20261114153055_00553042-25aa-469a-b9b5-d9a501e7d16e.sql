CREATE OR REPLACE FUNCTION public.blade_media_published(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.blade_provider_pages pg JOIN public.blade_providers p ON p.id = pg.provider_id AND p.status = 'active'
    WHERE p_name IS NOT NULL AND (pg.logo_path = p_name OR pg.cover_path = p_name OR p_name = ANY(pg.gallery_paths)))
$$;
REVOKE EXECUTE ON FUNCTION public.blade_media_published(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_media_published(text) TO anon, authenticated;
CREATE POLICY "Published BLADE provider media is viewable" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blade-provider-media' AND public.blade_media_published(name));