CREATE TABLE public.blade_legacy_assignment_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  previous_provider_id uuid,
  assigned_provider_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_legacy_assignment_backup TO authenticated;
GRANT ALL ON public.blade_legacy_assignment_backup TO service_role;
ALTER TABLE public.blade_legacy_assignment_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads legacy assignment backup" ON public.blade_legacy_assignment_backup
  FOR SELECT TO authenticated USING (public.is_superadmin());

DO $$
DECLARE pid uuid;
BEGIN
  SELECT id INTO pid FROM public.blade_providers WHERE user_id = 'da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND status = 'active';
  IF pid IS NULL THEN RAISE EXCEPTION 'LCS Barber provider not found'; END IF;

  INSERT INTO public.blade_legacy_assignment_backup(table_name,row_id,previous_provider_id,assigned_provider_id)
  SELECT 'services', id, provider_id, pid FROM public.services WHERE provider_id IS NULL
  UNION ALL SELECT 'bookings', id, provider_id, pid FROM public.bookings WHERE provider_id IS NULL
  UNION ALL SELECT 'clients', id, provider_id, pid FROM public.clients WHERE provider_id IS NULL
  UNION ALL SELECT 'client_merges', id, provider_id, pid FROM public.client_merges WHERE provider_id IS NULL
  UNION ALL SELECT 'pricing_settings', id, provider_id, pid FROM public.pricing_settings WHERE provider_id IS NULL
  UNION ALL SELECT 'email_templates', id, provider_id, pid FROM public.email_templates WHERE provider_id IS NULL
  UNION ALL SELECT 'prestations', id, provider_id, pid FROM public.prestations WHERE provider_id IS NULL;

  -- Services first so the booking link validation finds a matching owner.
  UPDATE public.services SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.clients SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.bookings SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.prestations SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.client_merges SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.pricing_settings SET provider_id = pid WHERE provider_id IS NULL;
  UPDATE public.email_templates SET provider_id = pid WHERE provider_id IS NULL;
END $$;

-- Rows created later by the LCSBARBER site (which never sets an owner) belong to LCS Barber.
CREATE OR REPLACE FUNCTION public.blade_default_lcs_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.provider_id IS NULL THEN
    SELECT id INTO NEW.provider_id FROM public.blade_providers WHERE user_id = 'da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.blade_default_lcs_provider() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER blade_default_provider_services BEFORE INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();
CREATE TRIGGER blade_default_provider_clients BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();
CREATE TRIGGER blade_default_provider_prestations BEFORE INSERT ON public.prestations FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();
CREATE TRIGGER blade_default_provider_merges BEFORE INSERT ON public.client_merges FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();
CREATE TRIGGER blade_default_provider_pricing BEFORE INSERT ON public.pricing_settings FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();
CREATE TRIGGER blade_default_provider_templates BEFORE INSERT ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.blade_default_lcs_provider();