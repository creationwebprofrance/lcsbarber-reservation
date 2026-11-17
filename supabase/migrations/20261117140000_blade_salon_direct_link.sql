-- Un salon publié doit avoir un lien de réservation : les clients sont redirigés directement vers lui.
ALTER TABLE public.blade_salons ADD CONSTRAINT blade_salons_published_needs_link
  CHECK (status <> 'published' OR booking_url IS NOT NULL);

-- La liste publique expose le lien pour le bouton « Réserver » direct.
CREATE OR REPLACE FUNCTION public.blade_public_salons()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'is_premium')::boolean DESC, x->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
      'lat', s.lat, 'lng', s.lng, 'specialties', s.specialties, 'price_from', s.price_from, 'cover_path', s.cover_path,
      'booking_platform', s.booking_platform, 'booking_url', s.booking_url, 'is_premium', public.blade_effective_plan(s.provider_id) = 'premium') AS x
    FROM public.blade_salons s WHERE public.blade_salon_is_public(s)
  ) t
$$;
