-- BLADE pro chat: offers of prestations between barbers + replies. Admin-only for now.
CREATE TABLE IF NOT EXISTS public.blade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  city text,
  offer_date date,
  price numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blade_offers TO authenticated;
GRANT ALL ON public.blade_offers TO service_role;
ALTER TABLE public.blade_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pro reads offers" ON public.blade_offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pro posts own offers" ON public.blade_offers FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pro updates own offers" ON public.blade_offers FOR UPDATE TO authenticated USING (author_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK (author_id=auth.uid());
CREATE POLICY "Pro deletes own offers" ON public.blade_offers FOR DELETE TO authenticated USING (author_id=auth.uid() AND public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.blade_offer_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.blade_offers(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.blade_offer_replies TO authenticated;
GRANT ALL ON public.blade_offer_replies TO service_role;
ALTER TABLE public.blade_offer_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pro reads replies" ON public.blade_offer_replies FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pro posts own replies" ON public.blade_offer_replies FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pro deletes own replies" ON public.blade_offer_replies FOR DELETE TO authenticated USING (author_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS blade_offer_replies_offer_idx ON public.blade_offer_replies(offer_id, created_at);

-- Length validation via trigger
CREATE OR REPLACE FUNCTION public.blade_validate_chat() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF length(trim(NEW.body)) < 1 OR length(NEW.body) > 2000 THEN RAISE EXCEPTION 'Message invalide'; END IF;
  IF TG_TABLE_NAME='blade_offers' AND (length(trim(NEW.title)) < 2 OR length(NEW.title) > 120) THEN RAISE EXCEPTION 'Titre invalide'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER blade_offers_validate BEFORE INSERT OR UPDATE ON public.blade_offers FOR EACH ROW EXECUTE FUNCTION public.blade_validate_chat();
CREATE TRIGGER blade_offer_replies_validate BEFORE INSERT OR UPDATE ON public.blade_offer_replies FOR EACH ROW EXECUTE FUNCTION public.blade_validate_chat();

ALTER PUBLICATION supabase_realtime ADD TABLE public.blade_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blade_offer_replies;