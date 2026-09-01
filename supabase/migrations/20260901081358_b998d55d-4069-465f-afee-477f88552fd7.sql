CREATE TABLE public.haircuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.haircuts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.haircuts TO authenticated;
GRANT ALL ON public.haircuts TO service_role;

ALTER TABLE public.haircuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view haircuts" ON public.haircuts FOR SELECT USING (true);
CREATE POLICY "Admins can manage haircuts" ON public.haircuts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER update_haircuts_updated_at BEFORE UPDATE ON public.haircuts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_email_sent boolean NOT NULL DEFAULT false;