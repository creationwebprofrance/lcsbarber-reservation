-- 1. Superadmin role for the verified LCS Barber account
INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'superadmin'::public.app_role FROM auth.users u
WHERE u.id='da0b2f45-1ee1-441e-a06d-3bd046615ca8' AND lower(trim(u.email))='lucas.chipan97@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='superadmin');

CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'superadmin'::public.app_role) $$;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- 2. Provider status, options, payment links and activity
ALTER TABLE public.blade_providers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS opt_payment_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_auto_emails boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_searchable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revolut_url text,
  ADD COLUMN IF NOT EXISTS stripe_link_url text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS inactivity_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.blade_validate_provider() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','active','suspended') THEN RAISE EXCEPTION 'Statut invalide'; END IF;
  IF NEW.display_name IS NOT NULL AND length(trim(NEW.display_name)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Nom invalide (2 à 80 caractères)'; END IF;
  NEW.revolut_url := NULLIF(trim(NEW.revolut_url),'');
  NEW.stripe_link_url := NULLIF(trim(NEW.stripe_link_url),'');
  IF NEW.revolut_url IS NOT NULL AND NEW.revolut_url !~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$' THEN RAISE EXCEPTION 'Lien Revolut invalide (https://revolut.me/...)'; END IF;
  IF NEW.stripe_link_url IS NOT NULL AND NEW.stripe_link_url !~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$' THEN RAISE EXCEPTION 'Lien Stripe invalide (https://buy.stripe.com/...)'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS blade_validate_provider ON public.blade_providers;
CREATE TRIGGER blade_validate_provider BEFORE INSERT OR UPDATE ON public.blade_providers FOR EACH ROW EXECUTE FUNCTION public.blade_validate_provider();

UPDATE public.blade_providers p SET status='active', display_name=COALESCE(p.display_name,'LCS Barber'),
  email=COALESCE(p.email,'lucas.chipan97@gmail.com'), opt_payment_links=true, opt_auto_emails=true, opt_searchable=true, validated_at=COALESCE(p.validated_at, now())
WHERE p.user_id='da0b2f45-1ee1-441e-a06d-3bd046615ca8';

-- 3. Ownership now depends on an active provider account, not on the admin role
CREATE OR REPLACE FUNCTION public.blade_owns_provider(p_provider uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.blade_providers WHERE id=p_provider AND user_id=auth.uid() AND status='active'); $$;

CREATE OR REPLACE FUNCTION public.blade_is_active_provider() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.blade_providers WHERE user_id=auth.uid() AND status='active'); $$;
REVOKE ALL ON FUNCTION public.blade_is_active_provider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_is_active_provider() TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_provider_visible(p_provider uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.blade_providers WHERE id=p_provider AND status='active' AND opt_searchable); $$;
REVOKE ALL ON FUNCTION public.blade_provider_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_provider_visible(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Provider reads own identity" ON public.blade_providers;
CREATE POLICY "Provider or superadmin reads" ON public.blade_providers FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_superadmin());

CREATE OR REPLACE FUNCTION public.blade_conversation_member(p_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.blade_private_conversations c JOIN public.blade_providers p ON p.id IN(c.provider_a,c.provider_b) WHERE c.id=p_conversation AND p.user_id=auth.uid() AND p.status='active');
$$;

DROP POLICY IF EXISTS "Public active profile" ON public.blade_public_profiles;
DROP POLICY IF EXISTS "Active profile or authenticated owner" ON public.blade_public_profiles;
CREATE POLICY "Public visible profile" ON public.blade_public_profiles FOR SELECT TO anon USING (active AND public.blade_provider_visible(provider_id));
CREATE POLICY "Visible profile or owner" ON public.blade_public_profiles FOR SELECT TO authenticated USING ((active AND public.blade_provider_visible(provider_id)) OR public.blade_owns_provider(provider_id));

-- Pro chat opens to every active provider
DROP POLICY IF EXISTS "Pro reads offers" ON public.blade_offers;
DROP POLICY IF EXISTS "Pro posts own offers" ON public.blade_offers;
DROP POLICY IF EXISTS "Pro updates own offers" ON public.blade_offers;
DROP POLICY IF EXISTS "Pro deletes own offers" ON public.blade_offers;
CREATE POLICY "Pro reads offers" ON public.blade_offers FOR SELECT TO authenticated USING (public.blade_is_active_provider());
CREATE POLICY "Pro posts own offers" ON public.blade_offers FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.blade_is_active_provider());
CREATE POLICY "Pro updates own offers" ON public.blade_offers FOR UPDATE TO authenticated USING (author_id=auth.uid() AND public.blade_is_active_provider()) WITH CHECK (author_id=auth.uid());
CREATE POLICY "Pro deletes own offers" ON public.blade_offers FOR DELETE TO authenticated USING (author_id=auth.uid() AND public.blade_is_active_provider());
DROP POLICY IF EXISTS "Pro reads replies" ON public.blade_offer_replies;
DROP POLICY IF EXISTS "Pro posts own replies" ON public.blade_offer_replies;
DROP POLICY IF EXISTS "Pro deletes own replies" ON public.blade_offer_replies;
CREATE POLICY "Pro reads replies" ON public.blade_offer_replies FOR SELECT TO authenticated USING (public.blade_is_active_provider());
CREATE POLICY "Pro posts own replies" ON public.blade_offer_replies FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.blade_is_active_provider());
CREATE POLICY "Pro deletes own replies" ON public.blade_offer_replies FOR DELETE TO authenticated USING (author_id=auth.uid() AND public.blade_is_active_provider());

-- 4. Deposit received tracking and reminder idempotency
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_method text,
  ADD COLUMN IF NOT EXISTS blade_reminder_sent_at timestamptz;

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.blade_my_provider() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.blade_providers;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('provider', NULL, 'is_superadmin', false); END IF;
  UPDATE public.blade_providers SET last_active_at=now()
   WHERE user_id=auth.uid() AND status='active' AND last_active_at < now() - interval '5 minutes';
  SELECT * INTO r FROM public.blade_providers WHERE user_id=auth.uid();
  RETURN jsonb_build_object('is_superadmin', public.is_superadmin(), 'provider', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', r.id, 'status', r.status, 'display_name', r.display_name, 'email', r.email,
    'opt_payment_links', r.opt_payment_links, 'opt_auto_emails', r.opt_auto_emails, 'opt_searchable', r.opt_searchable,
    'revolut_url', r.revolut_url, 'stripe_link_url', r.stripe_link_url, 'created_at', r.created_at) END);
END $$;
REVOKE ALL ON FUNCTION public.blade_my_provider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_my_provider() TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_register_provider(p_display_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF EXISTS(SELECT 1 FROM public.blade_providers WHERE user_id=auth.uid()) THEN RETURN public.blade_my_provider(); END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.blade_providers(id,user_id,status,display_name,email)
  VALUES (gen_random_uuid(), auth.uid(), 'pending', trim(p_display_name), lower(v_email));
  RETURN public.blade_my_provider();
END $$;
REVOKE ALL ON FUNCTION public.blade_register_provider(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_register_provider(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_update_own_provider(p_display_name text, p_revolut_url text, p_stripe_link_url text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.blade_providers;
BEGIN
  SELECT * INTO r FROM public.blade_providers WHERE user_id=auth.uid();
  IF r.id IS NULL OR r.status <> 'active' THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF NOT r.opt_payment_links AND (NULLIF(trim(p_revolut_url),'') IS NOT NULL OR NULLIF(trim(p_stripe_link_url),'') IS NOT NULL) THEN
    RAISE EXCEPTION 'Option non activée par LCS Barber';
  END IF;
  UPDATE public.blade_providers SET display_name=COALESCE(NULLIF(trim(p_display_name),''), display_name),
    revolut_url=p_revolut_url, stripe_link_url=p_stripe_link_url WHERE id=r.id;
  RETURN public.blade_my_provider();
END $$;
REVOKE ALL ON FUNCTION public.blade_update_own_provider(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_update_own_provider(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_admin_set_provider(p_provider uuid, p_status text, p_payment_links boolean, p_auto_emails boolean, p_searchable boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin'; END IF;
  UPDATE public.blade_providers SET status=p_status, opt_payment_links=p_payment_links, opt_auto_emails=p_auto_emails, opt_searchable=p_searchable,
    validated_at=CASE WHEN p_status='active' AND validated_at IS NULL THEN now() ELSE validated_at END,
    last_active_at=CASE WHEN p_status='active' AND status<>'active' THEN now() ELSE last_active_at END,
    inactivity_notified_at=CASE WHEN p_status='active' AND status<>'active' THEN NULL ELSE inactivity_notified_at END
  WHERE id=p_provider;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestataire introuvable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.blade_admin_set_provider(uuid,text,boolean,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_admin_set_provider(uuid,text,boolean,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin'; END IF;
  RETURN jsonb_build_object(
    'providers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'display_name',p.display_name,'email',p.email,'status',p.status,'created_at',p.created_at,'validated_at',p.validated_at,
        'last_active_at',p.last_active_at,'opt_payment_links',p.opt_payment_links,'opt_auto_emails',p.opt_auto_emails,'opt_searchable',p.opt_searchable,
        'has_revolut',p.revolut_url IS NOT NULL,'has_stripe_link',p.stripe_link_url IS NOT NULL,'is_self',p.user_id=auth.uid(),
        'clients',(SELECT count(*) FROM public.clients c WHERE c.provider_id=p.id),
        'bookings',(SELECT count(*) FROM public.bookings b WHERE b.provider_id=p.id)) ORDER BY p.created_at) FROM public.blade_providers p),'[]'::jsonb),
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'created_at',c.created_at,
        'provider_id',c.provider_id,'provider_name',p.display_name) ORDER BY c.name) FROM public.clients c LEFT JOIN public.blade_providers p ON p.id=c.provider_id),'[]'::jsonb),
    'unattributed_clients',(SELECT count(*) FROM public.clients WHERE provider_id IS NULL),
    'unattributed_bookings',(SELECT count(*) FROM public.bookings WHERE provider_id IS NULL));
END $$;
REVOKE ALL ON FUNCTION public.blade_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_admin_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_mark_deposit_received(p_booking uuid, p_method text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  IF p_method NOT IN ('revolut','stripe_link','autre') THEN RAISE EXCEPTION 'Moyen de paiement invalide'; END IF;
  SELECT provider_id INTO pid FROM public.bookings WHERE id=p_booking;
  IF pid IS NULL OR NOT public.blade_owns_provider(pid) THEN RAISE EXCEPTION 'Rendez-vous introuvable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.blade_providers WHERE id=pid AND opt_payment_links) THEN RAISE EXCEPTION 'Option non activée par LCS Barber'; END IF;
  UPDATE public.bookings SET deposit_paid=true, status='confirmed', deposit_received_at=now(), deposit_method=p_method
   WHERE id=p_booking AND status IN ('pending','confirmed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Ce rendez-vous ne peut plus être confirmé'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.blade_mark_deposit_received(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_mark_deposit_received(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.blade_booking_deposit_links(p_booking uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE b record;
BEGIN
  SELECT bk.id, bk.status, bk.deposit_paid, bk.client_email, p.status AS pstatus, p.opt_payment_links, p.revolut_url, p.stripe_link_url, p.display_name
    INTO b FROM public.bookings bk JOIN public.blade_providers p ON p.id=bk.provider_id WHERE bk.id=p_booking;
  IF b.id IS NULL OR lower(b.client_email) <> lower(COALESCE(auth.email(),'')) THEN RETURN NULL; END IF;
  IF b.pstatus <> 'active' OR NOT b.opt_payment_links OR b.deposit_paid THEN
    RETURN jsonb_build_object('available', false, 'deposit_paid', b.deposit_paid, 'status', b.status);
  END IF;
  RETURN jsonb_build_object('available', true, 'deposit_paid', b.deposit_paid, 'status', b.status, 'provider_name', b.display_name,
    'revolut_url', b.revolut_url, 'stripe_link_url', b.stripe_link_url);
END $$;
REVOKE ALL ON FUNCTION public.blade_booking_deposit_links(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_booking_deposit_links(uuid) TO authenticated;