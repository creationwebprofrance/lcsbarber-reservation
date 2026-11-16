CREATE TABLE public.blade_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (length(token) >= 32),
  status text NOT NULL CHECK (status IN ('en_route','arrived','cancelled')),
  started_at timestamptz NOT NULL,
  duration_s integer NOT NULL,
  distance_m integer NOT NULL,
  delay_min integer NOT NULL DEFAULT 0,
  arrived_at timestamptz,
  route jsonb NOT NULL,
  dest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blade_trips_provider_idx ON public.blade_trips(provider_id);

GRANT SELECT ON public.blade_trips TO authenticated;
GRANT ALL ON public.blade_trips TO service_role;
REVOKE ALL ON public.blade_trips FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.blade_trips FROM authenticated;

ALTER TABLE public.blade_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers read their own trips"
ON public.blade_trips FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = blade_trips.provider_id AND p.user_id = auth.uid()));

CREATE TRIGGER update_blade_trips_updated_at
BEFORE UPDATE ON public.blade_trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.blade_trip_public(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', t.status,
    'started_at', t.started_at,
    'duration_s', t.duration_s,
    'distance_m', t.distance_m,
    'delay_min', t.delay_min,
    'arrived_at', t.arrived_at,
    'route', t.route,
    'dest', t.dest,
    'provider_name', p.display_name,
    'appointment_date', b.appointment_date,
    'appointment_time', to_char(b.appointment_time, 'HH24:MI'),
    'server_now', now()
  )
  FROM public.blade_trips t
  JOIN public.blade_providers p ON p.id = t.provider_id
  JOIN public.bookings b ON b.id = t.booking_id
  WHERE p_token IS NOT NULL AND length(p_token) BETWEEN 32 AND 128 AND t.token = p_token
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.blade_trip_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blade_trip_public(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.blade_my_trips()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('booking_id', t.booking_id, 'token', t.token, 'status', t.status) ORDER BY b.appointment_date, b.appointment_time), '[]'::jsonb)
  FROM public.blade_trips t
  JOIN public.bookings b ON b.id = t.booking_id
  WHERE auth.uid() IS NOT NULL
    AND lower(b.client_email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
    AND b.appointment_date >= ((now() AT TIME ZONE 'Europe/Paris')::date - 1)
$$;
REVOKE ALL ON FUNCTION public.blade_my_trips() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_my_trips() FROM anon;
GRANT EXECUTE ON FUNCTION public.blade_my_trips() TO authenticated;