-- Profil personnel (client ou pro) : chaque compte lit et modifie uniquement le sien.
CREATE TABLE IF NOT EXISTS public.blade_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text CHECK (char_length(first_name) <= 80),
  last_name text CHECK (char_length(last_name) <= 80),
  phone text CHECK (char_length(phone) <= 30),
  address text CHECK (char_length(address) <= 300),
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blade_user_profiles ENABLE ROW LEVEL SECURITY;
-- Pas de politique : accès uniquement par les fonctions ci-dessous.
REVOKE ALL ON public.blade_user_profiles FROM PUBLIC, anon, authenticated;

-- Ne garde que les préférences connues, avec des valeurs bornées.
CREATE OR REPLACE FUNCTION public.blade_clean_prefs(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
    SELECT key k, CASE
      WHEN key IN ('notif_booking','notif_payment','notif_reminders','consent_reminders') THEN to_jsonb(value = 'true'::jsonb)
      ELSE to_jsonb(left(value #>> '{}', 600)) END v
    FROM jsonb_each(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END)
    WHERE key IN ('place','channel','hair','travel_conditions','notes','notif_booking','notif_payment','notif_reminders','consent_reminders')
      AND jsonb_typeof(value) IN ('string','boolean')
  ) x
$$;

CREATE OR REPLACE FUNCTION public.blade_my_profile()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT jsonb_build_object('first_name', first_name, 'last_name', last_name, 'phone', phone, 'address', address, 'prefs', prefs)
    INTO out FROM public.blade_user_profiles WHERE user_id = auth.uid();
  RETURN COALESCE(out, jsonb_build_object('first_name', null, 'last_name', null, 'phone', null, 'address', null, 'prefs', '{}'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.blade_save_my_profile(p_values jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Données invalides'; END IF;
  INSERT INTO public.blade_user_profiles AS t (user_id, first_name, last_name, phone, address, prefs, updated_at)
  VALUES (uid,
    NULLIF(left(trim(p_values->>'first_name'), 80), ''),
    NULLIF(left(trim(p_values->>'last_name'), 80), ''),
    NULLIF(left(trim(p_values->>'phone'), 30), ''),
    NULLIF(left(trim(p_values->>'address'), 300), ''),
    public.blade_clean_prefs(p_values->'prefs'), now())
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone,
    address = EXCLUDED.address, prefs = EXCLUDED.prefs, updated_at = now();
  RETURN public.blade_my_profile();
END $$;

REVOKE ALL ON FUNCTION public.blade_my_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blade_save_my_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.blade_save_my_profile(jsonb) TO authenticated;
