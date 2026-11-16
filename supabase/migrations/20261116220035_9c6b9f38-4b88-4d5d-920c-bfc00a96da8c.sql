-- 1) Offered plan columns
ALTER TABLE public.blade_subscriptions
  ADD COLUMN comp_plan text NULL CHECK (comp_plan IN ('pro','premium')),
  ADD COLUMN comp_until timestamptz NULL;

-- Offer Pro until 1 March 2027 to every provider existing now (Stripe fields untouched)
INSERT INTO public.blade_subscriptions (provider_id, comp_plan, comp_until)
SELECT id, 'pro', '2027-03-01 00:00:00+01'::timestamptz FROM public.blade_providers
ON CONFLICT (provider_id) DO UPDATE SET comp_plan = EXCLUDED.comp_plan, comp_until = EXCLUDED.comp_until;

-- 2) Single source of truth for a provider's plan
CREATE OR REPLACE FUNCTION public.blade_effective_plan(p_provider uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; s public.blade_subscriptions;
BEGIN
  SELECT user_id INTO v_user FROM public.blade_providers WHERE id = p_provider;
  IF v_user IS NULL THEN RETURN 'free'; END IF;
  IF public.has_role(v_user, 'superadmin'::public.app_role) THEN RETURN 'premium'; END IF;
  SELECT * INTO s FROM public.blade_subscriptions WHERE provider_id = p_provider;
  IF s.provider_id IS NULL THEN RETURN 'free'; END IF;
  IF s.status IN ('trialing','active','past_due') THEN RETURN s.plan; END IF;
  IF s.comp_plan IS NOT NULL AND (s.comp_until IS NULL OR s.comp_until > now()) THEN RETURN s.comp_plan; END IF;
  RETURN 'free';
END $$;
REVOKE ALL ON FUNCTION public.blade_effective_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_effective_plan(uuid) TO service_role;

-- Non-cancelled bookings of a provider in the Paris calendar month containing p_day
CREATE OR REPLACE FUNCTION public.blade_month_booking_count(p_provider uuid, p_day date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.bookings
  WHERE provider_id = p_provider
    AND appointment_date >= date_trunc('month', p_day)::date
    AND appointment_date < (date_trunc('month', p_day) + interval '1 month')::date
    AND status NOT IN ('cancelled','canceled')
$$;
REVOKE ALL ON FUNCTION public.blade_month_booking_count(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_month_booking_count(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.blade_my_plan()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; v_user uuid; s public.blade_subscriptions; v_plan text; v_source text; v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  SELECT id, user_id INTO pid, v_user FROM public.blade_providers WHERE user_id = auth.uid() LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Aucun compte prestataire' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.blade_subscriptions WHERE provider_id = pid;
  v_plan := public.blade_effective_plan(pid);
  v_source := CASE
    WHEN public.has_role(v_user, 'superadmin'::public.app_role) THEN 'superadmin'
    WHEN s.status IN ('trialing','active','past_due') THEN 'stripe'
    WHEN s.comp_plan IS NOT NULL AND (s.comp_until IS NULL OR s.comp_until > now()) THEN 'offert'
    ELSE 'gratuit' END;
  RETURN jsonb_build_object(
    'plan', v_plan, 'source', v_source, 'comp_until', s.comp_until,
    'bookings_this_month', public.blade_month_booking_count(pid, v_today),
    'booking_limit', CASE WHEN v_plan = 'free' THEN 20 ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.blade_my_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_my_plan() TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_admin_set_comp_plan(p_provider uuid, p_plan text, p_until timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.blade_subscriptions;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.blade_providers WHERE id = p_provider) THEN RAISE EXCEPTION 'Prestataire introuvable'; END IF;
  IF p_plan IS NOT NULL AND p_plan NOT IN ('pro','premium') THEN RAISE EXCEPTION 'Plan offert invalide (pro ou premium)'; END IF;
  INSERT INTO public.blade_subscriptions (provider_id, comp_plan, comp_until)
  VALUES (p_provider, p_plan, CASE WHEN p_plan IS NULL THEN NULL ELSE p_until END)
  ON CONFLICT (provider_id) DO UPDATE SET comp_plan = EXCLUDED.comp_plan, comp_until = EXCLUDED.comp_until
  RETURNING * INTO s;
  RETURN jsonb_build_object('provider_id', s.provider_id, 'comp_plan', s.comp_plan, 'comp_until', s.comp_until,
    'effective_plan', public.blade_effective_plan(p_provider));
END $$;
REVOKE ALL ON FUNCTION public.blade_admin_set_comp_plan(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_admin_set_comp_plan(uuid, text, timestamptz) TO authenticated;

-- 3b) No online deposit links on the free plan
CREATE OR REPLACE FUNCTION public.blade_booking_deposit_links(p_booking uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE b record;
BEGIN
  SELECT bk.id, bk.status, bk.deposit_paid, bk.client_email, bk.provider_id, p.status AS pstatus, p.opt_payment_links, p.revolut_url, p.stripe_link_url, p.display_name
    INTO b FROM public.bookings bk JOIN public.blade_providers p ON p.id=bk.provider_id WHERE bk.id=p_booking;
  IF b.id IS NULL OR lower(b.client_email) <> lower(COALESCE(auth.email(),'')) THEN RETURN NULL; END IF;
  IF b.pstatus <> 'active' OR NOT b.opt_payment_links OR b.deposit_paid OR public.blade_effective_plan(b.provider_id) = 'free' THEN
    RETURN jsonb_build_object('available', false, 'deposit_paid', b.deposit_paid, 'status', b.status);
  END IF;
  RETURN jsonb_build_object('available', true, 'deposit_paid', b.deposit_paid, 'status', b.status, 'provider_name', b.display_name,
    'revolut_url', b.revolut_url, 'stripe_link_url', b.stripe_link_url);
END $function$;

-- 3c) Loyalty writes require Pro or Premium
CREATE OR REPLACE FUNCTION public.blade_loyalty_issue_card(p_email text, p_name text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); v_email text := lower(trim(coalesce(p_email, ''))); v_name text := trim(coalesce(p_name, '')); cid uuid;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF public.blade_effective_plan(pid) = 'free' THEN RAISE EXCEPTION 'La carte de fidélité est incluse dans le plan Pro.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.blade_loyalty_programs WHERE provider_id = pid AND active) THEN RAISE EXCEPTION 'Active d’abord ta carte fidélité'; END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Adresse email invalide'; END IF;
  IF length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nom du client invalide (2 à 100 caractères)'; END IF;
  INSERT INTO public.blade_loyalty_cards(provider_id, client_email, client_name) VALUES (pid, v_email, v_name)
  ON CONFLICT (provider_id, client_email) DO UPDATE SET client_name = EXCLUDED.client_name, updated_at = now()
  RETURNING id INTO cid;
  RETURN public.blade_loyalty_card_json(cid, true);
END $function$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_add(p_card uuid, p_kind text, p_amount numeric DEFAULT NULL::numeric, p_points integer DEFAULT NULL::integer, p_label text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); c public.blade_loyalty_cards; prog public.blade_loyalty_programs; d integer; lbl text;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF public.blade_effective_plan(pid) = 'free' THEN RAISE EXCEPTION 'La carte de fidélité est incluse dans le plan Pro.'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.blade_loyalty_redeem(p_card uuid, p_reward text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); c public.blade_loyalty_cards; prog public.blade_loyalty_programs; rw jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF public.blade_effective_plan(pid) = 'free' THEN RAISE EXCEPTION 'La carte de fidélité est incluse dans le plan Pro.'; END IF;
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
END $function$;

-- 3e) Public provider list (search + map), Premium first, with is_premium
CREATE OR REPLACE FUNCTION public.blade_public_providers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(t.x ORDER BY t.is_premium DESC, t.name, t.provider_id), '[]'::jsonb) FROM (
    SELECT pp.provider_id, pp.name, (public.blade_effective_plan(pp.provider_id) = 'premium') AS is_premium,
      jsonb_build_object('provider_id', pp.provider_id, 'name', pp.name, 'city', pp.city, 'zone', pp.zone,
        'home', pp.home, 'near', pp.near, 'photo_path', pp.photo_path, 'latitude', pp.latitude, 'longitude', pp.longitude,
        'booking_path', pp.booking_path, 'is_premium', public.blade_effective_plan(pp.provider_id) = 'premium') AS x
    FROM public.blade_public_profiles pp JOIN public.blade_providers p ON p.id = pp.provider_id
    WHERE pp.active AND p.status = 'active' AND p.opt_searchable
  ) t
$$;
REVOKE ALL ON FUNCTION public.blade_public_providers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_public_providers() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.blade_public_page(p_provider uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pid uuid := COALESCE(p_provider, public.blade_lcs_provider_id()); pr record; pg jsonb; is_lcs boolean;
BEGIN
  SELECT id, display_name INTO pr FROM public.blade_providers WHERE id = pid AND status = 'active';
  IF pr.id IS NULL THEN RETURN NULL; END IF;
  is_lcs := pid = public.blade_lcs_provider_id();
  SELECT to_jsonb(p) - 'provider_id' INTO pg FROM public.blade_provider_pages p WHERE provider_id = pid;
  RETURN jsonb_build_object(
    'provider_id', pid, 'name', COALESCE(pr.display_name, 'Professionnel'), 'is_lcs', is_lcs, 'page', pg,
    'is_premium', public.blade_effective_plan(pid) = 'premium',
    'services', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'price', s.price, 'duration_minutes', s.duration_minutes) ORDER BY s.price)
                 FROM public.services s WHERE s.provider_id = pid AND s.is_active), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(t.x ORDER BY t.created_at DESC) FROM (
                 SELECT r.created_at, jsonb_build_object('id', r.id, 'client_name', r.client_name, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) AS x
                 FROM public.reviews r LEFT JOIN public.bookings b ON b.id = r.booking_id
                 WHERE b.provider_id = pid OR (r.booking_id IS NULL AND is_lcs) ORDER BY r.created_at DESC LIMIT 30) t), '[]'::jsonb),
    'hours', CASE WHEN is_lcs THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('day_of_week', c.day_of_week, 'start_time', c.start_time, 'end_time', c.end_time, 'mode', c.mode) ORDER BY c.day_of_week, c.start_time)
                 FROM public.calendar_settings c WHERE c.is_available), '[]'::jsonb) ELSE '[]'::jsonb END);
END $function$;