-- Additive ownership integration. No legacy business row is assigned here.
CREATE TABLE IF NOT EXISTS public.blade_providers (
 id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_providers TO authenticated;
GRANT ALL ON public.blade_providers TO service_role;
ALTER TABLE public.blade_providers ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blade_providers' AND policyname='Provider reads own identity') THEN CREATE POLICY "Provider reads own identity" ON public.blade_providers FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.has_role(auth.uid(),'admin')); END IF; END $policy$;
-- Identity was verified against auth.users, profiles and user_roles during the read-only audit.
INSERT INTO public.blade_providers(id,user_id)
SELECT u.id,u.id FROM auth.users u JOIN public.profiles p ON p.user_id=u.id
WHERE u.id='da0b2f45-1ee1-441e-a06d-3bd046615ca8' AND lower(trim(u.email))='lucas.chipan97@gmail.com'
AND public.has_role(u.id,'admin') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.blade_owns_provider(p_provider uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.blade_providers WHERE id=p_provider AND user_id=auth.uid()) AND public.has_role(auth.uid(),'admin'); $$;
REVOKE ALL ON FUNCTION public.blade_owns_provider(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_owns_provider(uuid) TO authenticated;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS services_blade_provider_idx ON public.services(provider_id);
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS pricing_settings_blade_provider_idx ON public.pricing_settings(provider_id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS clients_blade_provider_idx ON public.clients(provider_id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS bookings_blade_provider_idx ON public.bookings(provider_id);
ALTER TABLE public.client_merges ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS client_merges_blade_provider_idx ON public.client_merges(provider_id);
ALTER TABLE public.prestations ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS prestations_blade_provider_idx ON public.prestations(provider_id);
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.blade_providers(id);
CREATE INDEX IF NOT EXISTS email_templates_blade_provider_idx ON public.email_templates(provider_id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS city_normalized text;
ALTER TABLE public.prestations ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.prestations ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id);
CREATE UNIQUE INDEX IF NOT EXISTS pricing_provider_key ON public.pricing_settings(provider_id,setting_key) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS template_provider_type ON public.email_templates(provider_id,template_type) WHERE provider_id IS NOT NULL;
-- Restrictive policies compose with existing policies; public active services/pricing and
-- client own-booking reads remain intact. Legacy private rows remain accessible only to
-- the verified existing account as custodian, NOT as evidence of ownership.
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='services' AND policyname='Blade scoped insert') THEN CREATE POLICY "Blade scoped insert" ON public.services AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='services' AND policyname='Blade scoped update') THEN CREATE POLICY "Blade scoped update" ON public.services AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='services' AND policyname='Blade scoped delete') THEN CREATE POLICY "Blade scoped delete" ON public.services AS RESTRICTIVE FOR DELETE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Blade scoped insert') THEN CREATE POLICY "Blade scoped insert" ON public.pricing_settings AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Blade scoped update') THEN CREATE POLICY "Blade scoped update" ON public.pricing_settings AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_settings' AND policyname='Blade scoped delete') THEN CREATE POLICY "Blade scoped delete" ON public.pricing_settings AS RESTRICTIVE FOR DELETE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='Blade scoped access') THEN CREATE POLICY "Blade scoped access" ON public.clients AS RESTRICTIVE FOR ALL TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Blade scoped reads') THEN CREATE POLICY "Blade scoped reads" ON public.bookings AS RESTRICTIVE FOR SELECT TO authenticated USING ((public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) OR lower(client_email)=lower(auth.email())); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Blade scoped updates') THEN CREATE POLICY "Blade scoped updates" ON public.bookings AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Blade scoped deletes') THEN CREATE POLICY "Blade scoped deletes" ON public.bookings AS RESTRICTIVE FOR DELETE TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_merges' AND policyname='Blade scoped access') THEN CREATE POLICY "Blade scoped access" ON public.client_merges AS RESTRICTIVE FOR ALL TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prestations' AND policyname='Blade scoped access') THEN CREATE POLICY "Blade scoped access" ON public.prestations AS RESTRICTIVE FOR ALL TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' AND policyname='Blade scoped access') THEN CREATE POLICY "Blade scoped access" ON public.email_templates AS RESTRICTIVE FOR ALL TO authenticated USING (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))) WITH CHECK (public.blade_owns_provider(provider_id) OR (provider_id IS NULL AND auth.uid()='da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND public.has_role(auth.uid(),'admin'))); END IF; END $policy$;
CREATE OR REPLACE FUNCTION public.blade_provider_bundle() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; result jsonb;
BEGIN
 SELECT id INTO pid FROM public.blade_providers WHERE user_id=auth.uid();
 IF pid IS NULL OR NOT public.blade_owns_provider(pid) THEN RAISE EXCEPTION 'Provider access denied'; END IF;
 SELECT jsonb_build_object('provider_id',pid,
 'services',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM public.services s WHERE provider_id=pid),'[]'::jsonb),
 'pricing',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.pricing_settings s WHERE provider_id=pid),'[]'::jsonb),
 'clients',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM public.clients s WHERE provider_id=pid),'[]'::jsonb),
 'bookings',COALESCE((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('services',jsonb_build_object('name',v.name))) FROM public.bookings s JOIN public.services v ON v.id=s.service_id WHERE s.provider_id=pid),'[]'::jsonb),
 'work',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.prestations s WHERE provider_id=pid),'[]'::jsonb),
 'templates',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.email_templates s WHERE provider_id=pid),'[]'::jsonb),
 'merges',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.client_merges s WHERE provider_id=pid),'[]'::jsonb)) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.blade_provider_bundle() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.blade_provider_bundle() TO authenticated;
CREATE OR REPLACE FUNCTION public.blade_save_record(p_provider uuid,p_entity text,p_id uuid,p_values jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; cid uuid; bid uuid;
BEGIN
 IF NOT public.blade_owns_provider(p_provider) THEN RAISE EXCEPTION 'Provider access denied'; END IF;
 rid:=COALESCE(p_id,gen_random_uuid());
 IF p_entity='service' THEN
  IF length(trim(p_values->>'name')) NOT BETWEEN 2 AND 150 OR NOT (p_values ? 'price') OR NOT (p_values ? 'duration_minutes') OR (p_values->>'price')::numeric<0 OR (p_values->>'price')::text IN ('NaN','Infinity','-Infinity') OR (p_values->>'duration_minutes')::int NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Invalid service'; END IF;
  IF p_id IS NULL THEN INSERT INTO public.services(id,provider_id,name,description,price,duration_minutes,is_active) VALUES(rid,p_provider,trim(p_values->>'name'),p_values->>'description',(p_values->>'price')::numeric,(p_values->>'duration_minutes')::int,(p_values->>'is_active')::boolean);
  ELSE UPDATE public.services SET name=trim(p_values->>'name'),description=p_values->>'description',price=(p_values->>'price')::numeric,duration_minutes=(p_values->>'duration_minutes')::int,is_active=(p_values->>'is_active')::boolean WHERE id=rid AND provider_id=p_provider; IF NOT FOUND THEN RAISE EXCEPTION 'Service not owned'; END IF; END IF;
 ELSIF p_entity='price' THEN
  IF (p_values->>'price')::numeric<0 OR (p_values->>'price') IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid price'; END IF;
  UPDATE public.services SET price=(p_values->>'price')::numeric WHERE id=rid AND provider_id=p_provider; IF NOT FOUND THEN RAISE EXCEPTION 'Service not owned'; END IF;
 ELSIF p_entity='pricing' THEN
  IF NOT (p_values ? 'setting_value') OR (p_values->>'setting_value')::numeric<0 OR (p_values->>'setting_value') IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid value'; END IF;
  IF EXISTS(SELECT 1 FROM public.pricing_settings WHERE id=rid AND setting_key='travel_interval_minutes') AND (p_values->>'setting_value')::numeric<=0 THEN RAISE EXCEPTION 'Interval must be positive'; END IF;
  UPDATE public.pricing_settings SET setting_value=(p_values->>'setting_value')::numeric WHERE id=rid AND provider_id=p_provider; IF NOT FOUND THEN RAISE EXCEPTION 'Rule not owned'; END IF;
 ELSIF p_entity='template' THEN
  IF length(p_values->>'subject') NOT BETWEEN 1 AND 300 OR length(p_values->>'html_content')>100000 THEN RAISE EXCEPTION 'Invalid template'; END IF;
  UPDATE public.email_templates SET subject=p_values->>'subject',html_content=p_values->>'html_content' WHERE id=rid AND provider_id=p_provider; IF NOT FOUND THEN RAISE EXCEPTION 'Template not owned'; END IF;
 ELSIF p_entity='client' THEN
  IF length(trim(p_values->>'name')) NOT BETWEEN 2 AND 150 OR (p_values->>'unpaid_amount')::numeric<0 THEN RAISE EXCEPTION 'Invalid client'; END IF;
  UPDATE public.clients SET name=trim(p_values->>'name'),phone=p_values->>'phone',address=p_values->>'address',is_blacklisted=(p_values->>'is_blacklisted')::boolean,unpaid_amount=(p_values->>'unpaid_amount')::numeric WHERE id=rid AND provider_id=p_provider; IF NOT FOUND THEN RAISE EXCEPTION 'Client not owned'; END IF;
 ELSIF p_entity='work' THEN
  cid:=NULLIF(p_values->>'client_id','')::uuid; bid:=NULLIF(p_values->>'booking_id','')::uuid;
  IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=cid AND provider_id=p_provider) THEN RAISE EXCEPTION 'Client not owned'; END IF;
  IF bid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bookings WHERE id=bid AND provider_id=p_provider AND (cid IS NULL OR client_id=cid)) THEN RAISE EXCEPTION 'Booking/client mismatch'; END IF;
  IF length(trim(p_values->>'name')) NOT BETWEEN 2 AND 150 OR (p_values->>'amount')::numeric<0 OR (p_values->>'amount') IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid realization'; END IF;
  INSERT INTO public.prestations(id,provider_id,name,client_name,client_id,booking_id,amount,prestation_date,notes) VALUES(rid,p_provider,trim(p_values->>'name'),(SELECT name FROM public.clients WHERE id=cid),cid,bid,(p_values->>'amount')::numeric,(p_values->>'prestation_date')::date,p_values->>'notes');
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 RETURN rid;
END; $$;
REVOKE ALL ON FUNCTION public.blade_save_record(uuid,text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.blade_save_record(uuid,text,uuid,jsonb) TO authenticated;

-- Validate cross-provider relationships even for existing service-role writers.
CREATE OR REPLACE FUNCTION public.blade_validate_links() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE related_provider uuid;
BEGIN
 IF TG_TABLE_NAME='bookings' THEN
  SELECT provider_id INTO related_provider FROM public.services WHERE id=NEW.service_id;
  IF NEW.provider_id IS NULL AND related_provider IS NOT NULL THEN NEW.provider_id:=related_provider; END IF;
  IF NEW.provider_id IS DISTINCT FROM related_provider THEN RAISE EXCEPTION 'Service/provider mismatch'; END IF;
  IF NEW.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=NEW.client_id AND provider_id IS NOT DISTINCT FROM NEW.provider_id) THEN RAISE EXCEPTION 'Client/provider mismatch'; END IF;
 ELSIF TG_TABLE_NAME='prestations' THEN
  IF NEW.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=NEW.client_id AND provider_id IS NOT DISTINCT FROM NEW.provider_id) THEN RAISE EXCEPTION 'Client/provider mismatch'; END IF;
  IF NEW.booking_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bookings WHERE id=NEW.booking_id AND provider_id IS NOT DISTINCT FROM NEW.provider_id AND (NEW.client_id IS NULL OR client_id=NEW.client_id)) THEN RAISE EXCEPTION 'Booking/provider mismatch'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DO $triggers$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='blade_booking_links') THEN CREATE TRIGGER blade_booking_links BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.blade_validate_links(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='blade_work_links') THEN CREATE TRIGGER blade_work_links BEFORE INSERT OR UPDATE ON public.prestations FOR EACH ROW EXECUTE FUNCTION public.blade_validate_links(); END IF;
END $triggers$;
