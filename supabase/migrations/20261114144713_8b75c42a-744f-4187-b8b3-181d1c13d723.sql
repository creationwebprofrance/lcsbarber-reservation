-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.blade_provider_active(p_provider uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.blade_providers WHERE id = p_provider AND status = 'active')
$$;
CREATE OR REPLACE FUNCTION public.blade_lcs_provider_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.blade_providers p JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'superadmin' ORDER BY p.created_at LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.blade_my_provider_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.blade_providers WHERE user_id = auth.uid() AND status = 'active'
$$;

-- ===== Provider page (profile + booking customization) =====
CREATE TABLE public.blade_provider_pages (
  provider_id uuid PRIMARY KEY REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  accent_color text NOT NULL DEFAULT '#4B342B',
  font_key text NOT NULL DEFAULT 'classique',
  logo_path text,
  cover_path text,
  bio text,
  city text,
  salon_address text,
  instagram text,
  tiktok text,
  sections text[] NOT NULL DEFAULT ARRAY['services','gallery','reviews','hours','map']::text[],
  gallery_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  booking_modes text NOT NULL DEFAULT 'both',
  step_order text NOT NULL DEFAULT 'service',
  welcome_message text,
  booking_rules text,
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_provider_pages TO anon, authenticated;
GRANT ALL ON public.blade_provider_pages TO service_role;
ALTER TABLE public.blade_provider_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active provider pages are public" ON public.blade_provider_pages
  FOR SELECT TO anon, authenticated USING (public.blade_provider_active(provider_id));

CREATE OR REPLACE FUNCTION public.blade_validate_page() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
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
END $$;
CREATE TRIGGER blade_validate_page BEFORE INSERT OR UPDATE ON public.blade_provider_pages
  FOR EACH ROW EXECUTE FUNCTION public.blade_validate_page();

CREATE OR REPLACE FUNCTION public.blade_save_page(p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    custom_questions = CASE WHEN p_values ? 'custom_questions' THEN p_values->'custom_questions' ELSE custom_questions END
  WHERE provider_id = pid;
  SELECT to_jsonb(p) INTO out FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.blade_public_page(p_provider uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := COALESCE(p_provider, public.blade_lcs_provider_id()); pr record; pg jsonb; is_lcs boolean;
BEGIN
  SELECT id, display_name INTO pr FROM public.blade_providers WHERE id = pid AND status = 'active';
  IF pr.id IS NULL THEN RETURN NULL; END IF;
  is_lcs := pid = public.blade_lcs_provider_id();
  SELECT to_jsonb(p) - 'provider_id' INTO pg FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN jsonb_build_object(
    'provider_id', pid, 'name', COALESCE(pr.display_name, 'Professionnel'), 'is_lcs', is_lcs, 'page', pg,
    'services', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'price', s.price, 'duration_minutes', s.duration_minutes) ORDER BY s.price)
                 FROM public.services s WHERE s.provider_id = pid AND s.is_active), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(t.x ORDER BY t.created_at DESC) FROM (
                 SELECT r.created_at, jsonb_build_object('id', r.id, 'client_name', r.client_name, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) AS x
                 FROM public.reviews r LEFT JOIN public.bookings b ON b.id = r.booking_id
                 WHERE b.provider_id = pid OR (r.booking_id IS NULL AND is_lcs) ORDER BY r.created_at DESC LIMIT 30) t), '[]'::jsonb),
    'hours', CASE WHEN is_lcs THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('day_of_week', c.day_of_week, 'start_time', c.start_time, 'end_time', c.end_time, 'mode', c.mode) ORDER BY c.day_of_week, c.start_time)
                 FROM public.calendar_settings c WHERE c.is_available), '[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

-- Custom question answers kept on the booking
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS answers jsonb;

-- ===== Provider media storage (bucket created separately) =====
CREATE OR REPLACE FUNCTION public.blade_owns_media(p_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f text := split_part(coalesce(p_name, ''), '/', 1);
BEGIN
  IF f !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  RETURN public.blade_owns_provider(f::uuid);
END $$;
CREATE POLICY "BLADE providers read own media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blade-provider-media' AND public.blade_owns_media(name));
CREATE POLICY "BLADE providers upload own media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blade-provider-media' AND public.blade_owns_media(name));
CREATE POLICY "BLADE providers update own media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blade-provider-media' AND public.blade_owns_media(name))
  WITH CHECK (bucket_id = 'blade-provider-media' AND public.blade_owns_media(name));
CREATE POLICY "BLADE providers delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blade-provider-media' AND public.blade_owns_media(name));

-- ===== Loyalty =====
CREATE TABLE public.blade_loyalty_programs (
  provider_id uuid PRIMARY KEY REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT false,
  name text NOT NULL DEFAULT 'Carte fidélité',
  kind text NOT NULL DEFAULT 'visits',
  points_per_visit integer NOT NULL DEFAULT 1,
  points_per_euro numeric NOT NULL DEFAULT 1,
  rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_loyalty_programs TO authenticated;
GRANT ALL ON public.blade_loyalty_programs TO service_role;
ALTER TABLE public.blade_loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own loyalty program" ON public.blade_loyalty_programs
  FOR SELECT TO authenticated USING (public.blade_owns_provider(provider_id));

CREATE TABLE public.blade_loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  client_name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  code text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, client_email)
);
GRANT SELECT ON public.blade_loyalty_cards TO authenticated;
GRANT ALL ON public.blade_loyalty_cards TO service_role;
ALTER TABLE public.blade_loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers and card holders read loyalty cards" ON public.blade_loyalty_cards
  FOR SELECT TO authenticated USING (public.blade_owns_provider(provider_id) OR lower(client_email) = lower(coalesce(auth.email(), '')));

CREATE TABLE public.blade_loyalty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.blade_loyalty_cards(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  delta integer NOT NULL,
  amount numeric,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blade_loyalty_events_card_idx ON public.blade_loyalty_events(card_id, created_at DESC);
GRANT SELECT ON public.blade_loyalty_events TO authenticated;
GRANT ALL ON public.blade_loyalty_events TO service_role;
ALTER TABLE public.blade_loyalty_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers and card holders read loyalty history" ON public.blade_loyalty_events
  FOR SELECT TO authenticated USING (public.blade_owns_provider(provider_id) OR EXISTS (
    SELECT 1 FROM public.blade_loyalty_cards c WHERE c.id = card_id AND lower(c.client_email) = lower(coalesce(auth.email(), ''))));

-- Internal: card + provider + program + recent history as JSON (not callable by clients)
CREATE OR REPLACE FUNCTION public.blade_loyalty_card_json(p_card uuid, p_full boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'code', c.code, 'points', c.points, 'sent_at', c.sent_at, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'client_name', CASE WHEN p_full THEN c.client_name ELSE split_part(c.client_name, ' ', 1) END,
    'client_email', CASE WHEN p_full THEN c.client_email ELSE NULL END,
    'provider_id', p.id, 'provider_name', COALESCE(p.display_name, 'Professionnel'),
    'accent_color', COALESCE(pg.accent_color, '#4B342B'), 'font_key', COALESCE(pg.font_key, 'classique'), 'logo_path', pg.logo_path,
    'program', jsonb_build_object('active', COALESCE(pr.active, false), 'name', COALESCE(pr.name, 'Carte fidélité'), 'kind', COALESCE(pr.kind, 'visits'),
      'points_per_visit', COALESCE(pr.points_per_visit, 1), 'points_per_euro', COALESCE(pr.points_per_euro, 1), 'rewards', COALESCE(pr.rewards, '[]'::jsonb)),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', e.kind, 'delta', e.delta, 'label', e.label, 'created_at', e.created_at) ORDER BY e.created_at DESC)
      FROM (SELECT * FROM public.blade_loyalty_events WHERE card_id = c.id ORDER BY created_at DESC LIMIT 15) e), '[]'::jsonb))
  FROM public.blade_loyalty_cards c
  JOIN public.blade_providers p ON p.id = c.provider_id
  LEFT JOIN public.blade_provider_pages pg ON pg.provider_id = c.provider_id
  LEFT JOIN public.blade_loyalty_programs pr ON pr.provider_id = c.provider_id
  WHERE c.id = p_card
$$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_save_program(p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id(); r jsonb; ids text[] := ARRAY[]::text[];
  v_kind text := p_values->>'kind'; v_name text := trim(coalesce(p_values->>'name', '')); v_ppv text := p_values->>'points_per_visit'; v_ppe text := p_values->>'points_per_euro';
  v_rewards jsonb := COALESCE(p_values->'rewards', '[]'::jsonb); out jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF v_kind IS NULL OR v_kind NOT IN ('visits','euros') THEN RAISE EXCEPTION 'Choisis « par visite » ou « par euro dépensé »'; END IF;
  IF length(v_name) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Nom de la carte invalide (2 à 60 caractères)'; END IF;
  IF coalesce(v_ppv, '') !~ '^[0-9]{1,3}$' OR v_ppv::int NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Points par visite : entre 1 et 100'; END IF;
  IF coalesce(v_ppe, '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' OR v_ppe::numeric <= 0 OR v_ppe::numeric > 100 THEN RAISE EXCEPTION 'Points par euro : entre 0,01 et 100'; END IF;
  IF jsonb_typeof(v_rewards) IS DISTINCT FROM 'array' OR jsonb_array_length(v_rewards) > 8 THEN RAISE EXCEPTION '8 récompenses maximum'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(v_rewards) LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR coalesce(r->>'id', '') !~ '^[a-z0-9-]{1,40}$' OR (r->>'id') = ANY(ids) THEN RAISE EXCEPTION 'Récompense invalide'; END IF;
    ids := ids || (r->>'id');
    IF length(trim(coalesce(r->>'label', ''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Nom de récompense invalide (2 à 80 caractères)'; END IF;
    IF coalesce(r->>'points', '') !~ '^[0-9]{1,6}$' OR (r->>'points')::int < 1 THEN RAISE EXCEPTION 'Points de récompense invalides'; END IF;
  END LOOP;
  IF COALESCE((p_values->>'active')::boolean, false) AND jsonb_array_length(v_rewards) = 0 THEN RAISE EXCEPTION 'Ajoute au moins une récompense avant d’activer la carte'; END IF;
  INSERT INTO public.blade_loyalty_programs(provider_id, active, name, kind, points_per_visit, points_per_euro, rewards)
  VALUES (pid, COALESCE((p_values->>'active')::boolean, false), v_name, v_kind, v_ppv::int, v_ppe::numeric,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x->>'id', 'label', trim(x->>'label'), 'points', (x->>'points')::int) ORDER BY (x->>'points')::int), '[]'::jsonb) FROM jsonb_array_elements(v_rewards) x))
  ON CONFLICT (provider_id) DO UPDATE SET active = EXCLUDED.active, name = EXCLUDED.name, kind = EXCLUDED.kind, points_per_visit = EXCLUDED.points_per_visit,
    points_per_euro = EXCLUDED.points_per_euro, rewards = EXCLUDED.rewards, updated_at = now();
  SELECT to_jsonb(p) INTO out FROM public.blade_loyalty_programs p WHERE provider_id = pid;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id();
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  RETURN jsonb_build_object(
    'program', (SELECT to_jsonb(p) FROM public.blade_loyalty_programs p WHERE provider_id = pid),
    'cards', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'client_name', c.client_name, 'client_email', c.client_email, 'points', c.points,
        'sent_at', c.sent_at, 'created_at', c.created_at, 'updated_at', c.updated_at) ORDER BY c.updated_at DESC)
      FROM public.blade_loyalty_cards c WHERE c.provider_id = pid), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_issue_card(p_email text, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id(); v_email text := lower(trim(coalesce(p_email, ''))); v_name text := trim(coalesce(p_name, '')); cid uuid;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.blade_loyalty_programs WHERE provider_id = pid AND active) THEN RAISE EXCEPTION 'Active d’abord ta carte fidélité'; END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Adresse email invalide'; END IF;
  IF length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nom du client invalide (2 à 100 caractères)'; END IF;
  INSERT INTO public.blade_loyalty_cards(provider_id, client_email, client_name) VALUES (pid, v_email, v_name)
  ON CONFLICT (provider_id, client_email) DO UPDATE SET client_name = EXCLUDED.client_name, updated_at = now()
  RETURNING id INTO cid;
  RETURN public.blade_loyalty_card_json(cid, true);
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_find(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id(); c record;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  SELECT id, provider_id INTO c FROM public.blade_loyalty_cards WHERE code = lower(trim(coalesce(p_code, '')));
  IF c.id IS NULL THEN RAISE EXCEPTION 'Carte introuvable'; END IF;
  IF c.provider_id <> pid THEN RAISE EXCEPTION 'Cette carte appartient à un autre professionnel'; END IF;
  RETURN public.blade_loyalty_card_json(c.id, true);
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_add(p_card uuid, p_kind text, p_amount numeric DEFAULT NULL, p_points integer DEFAULT NULL, p_label text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id(); c public.blade_loyalty_cards; prog public.blade_loyalty_programs; d integer; lbl text;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  SELECT * INTO c FROM public.blade_loyalty_cards WHERE id = p_card AND provider_id = pid FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Carte introuvable'; END IF;
  SELECT * INTO prog FROM public.blade_loyalty_programs WHERE provider_id = pid;
  IF prog.provider_id IS NULL OR NOT prog.active THEN RAISE EXCEPTION 'Ta carte fidélité n’est pas active'; END IF;
  IF p_kind = 'visit' THEN
    IF prog.kind <> 'visits' THEN RAISE EXCEPTION 'Ta carte compte les euros dépensés : indique un montant'; END IF;
    IF EXISTS(SELECT 1 FROM public.blade_loyalty_events WHERE card_id = c.id AND kind = 'visit' AND created_at > now() - interval '1 hour') THEN
      RAISE EXCEPTION 'Une visite a déjà été ajoutée il y a moins d’une heure';
    END IF;
    d := prog.points_per_visit; lbl := 'Visite';
  ELSIF p_kind = 'amount' THEN
    IF prog.kind <> 'euros' THEN RAISE EXCEPTION 'Ta carte compte les visites : ajoute une visite'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
    d := floor(p_amount * prog.points_per_euro)::integer;
    IF d < 1 THEN RAISE EXCEPTION 'Montant trop faible pour gagner un point'; END IF;
    lbl := 'Dépense de ' || trim(to_char(p_amount, 'FM999990.00')) || ' €';
  ELSIF p_kind = 'manual' THEN
    IF p_points IS NULL OR p_points = 0 OR abs(p_points) > 10000 THEN RAISE EXCEPTION 'Nombre de points invalide'; END IF;
    IF c.points + p_points < 0 THEN RAISE EXCEPTION 'Le solde ne peut pas devenir négatif'; END IF;
    d := p_points; lbl := COALESCE(NULLIF(left(trim(coalesce(p_label, '')), 80), ''), 'Ajustement');
  ELSE RAISE EXCEPTION 'Action inconnue'; END IF;
  UPDATE public.blade_loyalty_cards SET points = points + d, updated_at = now() WHERE id = c.id;
  INSERT INTO public.blade_loyalty_events(card_id, provider_id, kind, delta, amount, label) VALUES (c.id, pid, p_kind, d, CASE WHEN p_kind = 'amount' THEN p_amount END, lbl);
  RETURN public.blade_loyalty_card_json(c.id, true);
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_redeem(p_card uuid, p_reward text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.blade_my_provider_id(); c public.blade_loyalty_cards; prog public.blade_loyalty_programs; rw jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  SELECT * INTO c FROM public.blade_loyalty_cards WHERE id = p_card AND provider_id = pid FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Carte introuvable'; END IF;
  SELECT * INTO prog FROM public.blade_loyalty_programs WHERE provider_id = pid;
  IF prog.provider_id IS NULL OR NOT prog.active THEN RAISE EXCEPTION 'Ta carte fidélité n’est pas active'; END IF;
  SELECT x INTO rw FROM jsonb_array_elements(prog.rewards) x WHERE x->>'id' = p_reward;
  IF rw IS NULL THEN RAISE EXCEPTION 'Récompense introuvable'; END IF;
  IF c.points < (rw->>'points')::int THEN RAISE EXCEPTION 'Pas assez de points pour cette récompense'; END IF;
  UPDATE public.blade_loyalty_cards SET points = points - (rw->>'points')::int, updated_at = now() WHERE id = c.id;
  INSERT INTO public.blade_loyalty_events(card_id, provider_id, kind, delta, label) VALUES (c.id, pid, 'reward', -(rw->>'points')::int, 'Récompense : ' || (rw->>'label'));
  RETURN public.blade_loyalty_card_json(c.id, true);
END $$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_public_card(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF coalesce(p_code, '') !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT c.id INTO cid FROM public.blade_loyalty_cards c JOIN public.blade_providers p ON p.id = c.provider_id AND p.status = 'active' WHERE c.code = p_code;
  IF cid IS NULL THEN RETURN NULL; END IF;
  RETURN public.blade_loyalty_card_json(cid, false);
END $$;

CREATE OR REPLACE FUNCTION public.blade_my_loyalty_cards() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(public.blade_loyalty_card_json(c.id, true) ORDER BY c.updated_at DESC), '[]'::jsonb)
  FROM public.blade_loyalty_cards c JOIN public.blade_providers p ON p.id = c.provider_id AND p.status = 'active'
  WHERE auth.email() IS NOT NULL AND lower(c.client_email) = lower(auth.email())
$$;

-- ===== Function permissions =====
REVOKE EXECUTE ON FUNCTION public.blade_loyalty_card_json(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_save_page(jsonb), public.blade_loyalty_save_program(jsonb), public.blade_loyalty_overview(),
  public.blade_loyalty_issue_card(text, text), public.blade_loyalty_find(text), public.blade_loyalty_add(uuid, text, numeric, integer, text),
  public.blade_loyalty_redeem(uuid, text), public.blade_my_loyalty_cards(), public.blade_my_provider_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_save_page(jsonb), public.blade_loyalty_save_program(jsonb), public.blade_loyalty_overview(),
  public.blade_loyalty_issue_card(text, text), public.blade_loyalty_find(text), public.blade_loyalty_add(uuid, text, numeric, integer, text),
  public.blade_loyalty_redeem(uuid, text), public.blade_my_loyalty_cards(), public.blade_my_provider_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.blade_public_page(uuid), public.blade_loyalty_public_card(text), public.blade_provider_active(uuid), public.blade_lcs_provider_id(), public.blade_owns_media(text) TO anon, authenticated;