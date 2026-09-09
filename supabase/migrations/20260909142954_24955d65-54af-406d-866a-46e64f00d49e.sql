CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  label text,
  make text,
  model text,
  generation text,
  phase text,
  body_type text,
  production_start date,
  production_end date,
  model_year integer,
  first_registration date,
  plate text,
  plate_country text NOT NULL DEFAULT 'FR',
  plate_raw text,
  vin text,
  cnit text,
  tvv text,
  ademe_ref text,
  fuel text,
  electrification text,
  engine_version text,
  engine_code text,
  displacement_cm3 integer,
  power_kw numeric,
  fiscal_power integer,
  gearbox_type text,
  gearbox_gears integer,
  gearbox_code text,
  odometer_unit text NOT NULL DEFAULT 'km',
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'partial',
  archived boolean NOT NULL DEFAULT false,
  notes text,
  visual_source text,
  visual_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_field_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  source text NOT NULL,
  source_date date,
  original_value text,
  retained_value text,
  confirmed_by_user boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'to_confirm',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT 'km',
  reading_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual',
  confirmed boolean NOT NULL DEFAULT true,
  is_correction boolean NOT NULL DEFAULT false,
  is_replacement boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title text,
  trip_type text NOT NULL DEFAULT 'aller',
  usage text NOT NULL DEFAULT 'professionnel',
  state text NOT NULL DEFAULT 'prevu',
  started_at timestamptz,
  ended_at timestamptz,
  planned_distance_km numeric,
  gps_distance_km numeric,
  odometer_distance_km numeric,
  declared_distance_km numeric,
  retained_distance_km numeric,
  retained_distance_source text,
  distance_is_estimate boolean NOT NULL DEFAULT true,
  business_share numeric NOT NULL DEFAULT 1,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_trip_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.vehicle_trips(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text,
  address text,
  latitude numeric,
  longitude numeric,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  arrival_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_maintenance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  category text NOT NULL,
  operation text NOT NULL,
  component text,
  action_type text NOT NULL DEFAULT 'remplacement',
  applicability text,
  source text NOT NULL DEFAULT 'personnel',
  source_reference text,
  interval_km integer,
  interval_months integer,
  first_interval_km integer,
  first_interval_months integer,
  fixed_due_date date,
  reference_odometer numeric,
  reference_date date,
  condition_based boolean NOT NULL DEFAULT false,
  estimated_budget numeric,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.vehicle_maintenance_rules(id) ON DELETE SET NULL,
  operation text NOT NULL,
  action_type text NOT NULL DEFAULT 'remplacement',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  odometer numeric,
  odometer_unit text NOT NULL DEFAULT 'km',
  provider text,
  cost numeric,
  source text NOT NULL DEFAULT 'personnel',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.vehicle_trips(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'autre',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  quantity numeric,
  quantity_unit text,
  is_estimate boolean NOT NULL DEFAULT false,
  document_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'autre',
  title text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  doc_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_api_quota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  period text NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  max_calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, period)
);

CREATE INDEX idx_vehicles_owner ON public.vehicles(owner_id);
CREATE UNIQUE INDEX idx_vehicles_vin_owner ON public.vehicles(owner_id, vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_odometer_vehicle_date ON public.odometer_readings(vehicle_id, reading_date);
CREATE INDEX idx_trips_vehicle ON public.vehicle_trips(vehicle_id, started_at);
CREATE INDEX idx_trips_booking ON public.vehicle_trips(booking_id);
CREATE INDEX idx_legs_trip ON public.vehicle_trip_legs(trip_id, position);
CREATE INDEX idx_rules_vehicle ON public.vehicle_maintenance_rules(vehicle_id);
CREATE INDEX idx_mevents_vehicle ON public.vehicle_maintenance_events(vehicle_id, event_date);
CREATE INDEX idx_expenses_vehicle ON public.vehicle_expenses(vehicle_id, expense_date);
CREATE INDEX idx_docs_vehicle ON public.vehicle_documents(vehicle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_field_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.odometer_readings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_trip_legs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT SELECT ON public.vehicle_api_quota TO authenticated;

GRANT ALL ON public.vehicles TO service_role;
GRANT ALL ON public.vehicle_field_sources TO service_role;
GRANT ALL ON public.odometer_readings TO service_role;
GRANT ALL ON public.vehicle_trips TO service_role;
GRANT ALL ON public.vehicle_trip_legs TO service_role;
GRANT ALL ON public.vehicle_maintenance_rules TO service_role;
GRANT ALL ON public.vehicle_maintenance_events TO service_role;
GRANT ALL ON public.vehicle_expenses TO service_role;
GRANT ALL ON public.vehicle_documents TO service_role;
GRANT ALL ON public.vehicle_api_quota TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_field_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_trip_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_maintenance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_api_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_admin() AND owner_id = auth.uid())
  WITH CHECK (public.is_admin() AND owner_id = auth.uid());

CREATE POLICY "Admins manage vehicle field sources" ON public.vehicle_field_sources FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins manage odometer readings" ON public.odometer_readings FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins manage vehicle trips" ON public.vehicle_trips FOR ALL TO authenticated
  USING (public.is_admin() AND (vehicle_id IS NULL OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid())))
  WITH CHECK (public.is_admin() AND (vehicle_id IS NULL OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid())));

CREATE POLICY "Admins manage trip legs" ON public.vehicle_trip_legs FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicle_trips t WHERE t.id = trip_id))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicle_trips t WHERE t.id = trip_id));

CREATE POLICY "Admins manage maintenance rules" ON public.vehicle_maintenance_rules FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins manage maintenance events" ON public.vehicle_maintenance_events FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins manage vehicle expenses" ON public.vehicle_expenses FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins manage vehicle documents" ON public.vehicle_documents FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid()));

CREATE POLICY "Admins read api quota" ON public.vehicle_api_quota FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicle_trips_updated_at BEFORE UPDATE ON public.vehicle_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicle_rules_updated_at BEFORE UPDATE ON public.vehicle_maintenance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_single_default_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.vehicles
    SET is_default = false
    WHERE owner_id = NEW.owner_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_vehicle
  AFTER INSERT OR UPDATE OF is_default ON public.vehicles
  FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.enforce_single_default_vehicle();

CREATE OR REPLACE FUNCTION public.consume_vehicle_api_quota(_provider text, _max_calls integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_count integer;
BEGIN
  INSERT INTO public.vehicle_api_quota (provider, period, call_count, max_calls)
  VALUES (_provider, v_period, 0, _max_calls)
  ON CONFLICT (provider, period) DO UPDATE SET max_calls = EXCLUDED.max_calls;

  UPDATE public.vehicle_api_quota
  SET call_count = call_count + 1, updated_at = now()
  WHERE provider = _provider AND period = v_period AND call_count < _max_calls
  RETURNING call_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT call_count INTO v_count FROM public.vehicle_api_quota
    WHERE provider = _provider AND period = v_period;
    RETURN json_build_object('allowed', false, 'used', v_count, 'max', _max_calls, 'period', v_period);
  END IF;

  RETURN json_build_object('allowed', true, 'used', v_count, 'max', _max_calls, 'period', v_period);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_vehicle_api_quota(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_vehicle_api_quota(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.consume_vehicle_api_quota(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_vehicle_api_quota(text, integer) TO service_role;

CREATE POLICY "Admins manage vehicle documents storage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'vehicle-documents' AND public.is_admin())
WITH CHECK (bucket_id = 'vehicle-documents' AND public.is_admin());