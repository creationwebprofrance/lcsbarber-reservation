-- Fiches « Salon » : un pro de la coiffure qui a déjà un salon (et parfois déjà un outil de
-- réservation comme Planity) le référence sur BLADE. Le bouton « Réserver » renvoie vers son outil.

CREATE TABLE public.blade_salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  address text NOT NULL CHECK (length(btrim(address)) BETWEEN 5 AND 200),
  city text CHECK (city IS NULL OR length(city) <= 80),
  postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
  lat double precision CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng double precision CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  phone text CHECK (phone IS NULL OR length(phone) <= 25),
  instagram text CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  website text CHECK (website IS NULL OR website ~* '^https://[^ ]+$'),
  booking_url text CHECK (booking_url IS NULL OR booking_url ~* '^https://[^ ]+$'),
  booking_platform text CHECK (booking_platform IS NULL OR booking_platform IN ('planity','treatwell','site','instagram','autre')),
  specialties text[] NOT NULL DEFAULT '{}' CHECK (array_length(specialties, 1) IS NULL OR array_length(specialties, 1) <= 12),
  description text CHECK (description IS NULL OR length(description) <= 800),
  price_from numeric CHECK (price_from IS NULL OR price_from BETWEEN 0 AND 1000),
  hours text CHECK (hours IS NULL OR length(hours) <= 400),
  cover_path text,
  gallery_paths text[] NOT NULL DEFAULT '{}' CHECK (array_length(gallery_paths, 1) IS NULL OR array_length(gallery_paths, 1) <= 8),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blade_salons_status_idx ON public.blade_salons(status);

-- Adresse lisible dans l'URL (/blade/salon/<slug>), générée à la création.
CREATE OR REPLACE FUNCTION public.blade_salons_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.slug := trim(both '-' from regexp_replace(lower(translate(NEW.name,
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(md5(random()::text), 1, 5);
  ELSE
    NEW.slug := OLD.slug;                       -- le lien ne change jamais
    NEW.provider_id := OLD.provider_id;
    NEW.updated_at := now();
  END IF;
  -- Seul l'administrateur peut masquer un salon ou rendre visible un salon masqué.
  IF NOT public.is_superadmin() AND (NEW.status = 'hidden' OR (TG_OP = 'UPDATE' AND OLD.status = 'hidden')) THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Ce salon a été masqué par BLADE. Contacte le support.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER blade_salons_before_write BEFORE INSERT OR UPDATE ON public.blade_salons
FOR EACH ROW EXECUTE FUNCTION public.blade_salons_before_write();

ALTER TABLE public.blade_salons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blade_salons FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blade_salons TO authenticated;
GRANT ALL ON public.blade_salons TO service_role;

CREATE POLICY "Salon owner or superadmin reads" ON public.blade_salons FOR SELECT TO authenticated
USING (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));
CREATE POLICY "Salon owner creates" ON public.blade_salons FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));
CREATE POLICY "Salon owner or superadmin updates" ON public.blade_salons FOR UPDATE TO authenticated
USING (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = provider_id AND p.user_id = auth.uid()))
WITH CHECK (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));
CREATE POLICY "Salon owner or superadmin deletes" ON public.blade_salons FOR DELETE TO authenticated
USING (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

-- Clics envoyés vers le salon (preuve de la valeur apportée par BLADE).
CREATE TABLE public.blade_salon_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.blade_salons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('booking','phone','instagram','website','directions','view')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blade_salon_clicks_salon_idx ON public.blade_salon_clicks(salon_id, created_at);
ALTER TABLE public.blade_salon_clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blade_salon_clicks FROM anon, authenticated;
GRANT ALL ON public.blade_salon_clicks TO service_role;

-- Un salon est public s'il est publié et que son prestataire est actif.
CREATE OR REPLACE FUNCTION public.blade_salon_is_public(s public.blade_salons)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.status = 'published' AND EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = s.provider_id AND p.status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.blade_public_salons()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'is_premium')::boolean DESC, x->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
      'lat', s.lat, 'lng', s.lng, 'specialties', s.specialties, 'price_from', s.price_from, 'cover_path', s.cover_path,
      'booking_platform', s.booking_platform, 'is_premium', public.blade_effective_plan(s.provider_id) = 'premium') AS x
    FROM public.blade_salons s WHERE public.blade_salon_is_public(s)
  ) t
$$;

CREATE OR REPLACE FUNCTION public.blade_salon_public(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'address', s.address, 'city', s.city, 'postal_code', s.postal_code,
    'lat', s.lat, 'lng', s.lng, 'phone', s.phone, 'instagram', s.instagram, 'website', s.website, 'booking_url', s.booking_url,
    'booking_platform', s.booking_platform, 'specialties', s.specialties, 'description', s.description, 'price_from', s.price_from,
    'hours', s.hours, 'cover_path', s.cover_path, 'gallery_paths', s.gallery_paths,
    'is_premium', public.blade_effective_plan(s.provider_id) = 'premium')
  FROM public.blade_salons s WHERE s.slug = p_slug AND public.blade_salon_is_public(s) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.blade_salon_click(p_salon uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind NOT IN ('booking','phone','instagram','website','directions','view') THEN RETURN; END IF;
  INSERT INTO public.blade_salon_clicks(salon_id, kind)
  SELECT s.id, p_kind FROM public.blade_salons s WHERE s.id = p_salon AND public.blade_salon_is_public(s);
END $$;

CREATE OR REPLACE FUNCTION public.blade_my_salon_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(kind, n), '{}'::jsonb) FROM (
    SELECT c.kind, count(*) AS n FROM public.blade_salon_clicks c
    JOIN public.blade_salons s ON s.id = c.salon_id
    JOIN public.blade_providers p ON p.id = s.provider_id AND p.user_id = auth.uid()
    WHERE c.created_at > now() - interval '30 days' GROUP BY c.kind
  ) t
$$;

REVOKE ALL ON FUNCTION public.blade_salon_is_public(public.blade_salons) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blade_public_salons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_salon_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_salon_click(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_my_salon_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_public_salons() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_salon_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_salon_click(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_my_salon_stats() TO authenticated;

-- Les photos d'un salon publié sont visibles par tout le monde (comme celles des pages pros).
CREATE OR REPLACE FUNCTION public.blade_media_published(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS(SELECT 1 FROM public.blade_provider_pages pg JOIN public.blade_providers p ON p.id = pg.provider_id AND p.status = 'active'
      WHERE p_name IS NOT NULL AND (pg.logo_path = p_name OR pg.cover_path = p_name OR p_name = ANY(pg.gallery_paths)))
    OR EXISTS(SELECT 1 FROM public.blade_salons s WHERE p_name IS NOT NULL AND public.blade_salon_is_public(s)
      AND (s.cover_path = p_name OR p_name = ANY(s.gallery_paths)))
$function$;
