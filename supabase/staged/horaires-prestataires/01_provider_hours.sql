-- Horaires d'ouverture propres à chaque prestataire BLADE.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : blade-booking lit public.calendar_settings et public.date_overrides, qui n'ont pas de
--   colonne prestataire : ce sont les horaires de LCS Barber. Un autre prestataire n'a donc aucun
--   créneau et ne peut pas régler les siens.
-- Ce que fait le fichier (uniquement des AJOUTS ; rien n'est modifié ni supprimé) :
--   1. table blade_provider_hours : horaires de la semaine, une ligne par plage
--      (jour 0 = dimanche … 6 = samedi, début, fin, lieu 'both' | 'domicile' | 'deplacement').
--   2. table blade_provider_date_overrides : exceptions datées (fermeture d'une journée,
--      ou horaires spéciaux qui remplacent ceux de la semaine ce jour-là).
--   3. RLS : chaque prestataire lit seulement ses lignes (même motif que blade_subscriptions ;
--      blade_my_provider_id() n'est pas exécutable par authenticated, donc pas utilisable en politique). Aucune écriture directe : les écritures
--      passent par les fonctions ci-dessous (SECURITY DEFINER, prestataire actif via
--      blade_my_provider_id()), qui renvoient des messages en français.
--      Les clients ne lisent pas ces tables : blade-booking (clé service) calcule les créneaux.
--   4. blade_save_hours(jsonb) remplace d'un coup les horaires de la semaine du prestataire
--      connecté ; blade_add_date_override(...) et blade_delete_date_override(uuid) gèrent les
--      exceptions.
-- Ce qui ne change pas : calendar_settings, date_overrides et les horaires de LCS Barber
--   (blade-booking continue de les lire pour le compte superadmin).
-- Données personnelles : aucune (jours et heures d'ouverture).
-- Limites anti-abus : 42 plages par semaine, 400 exceptions à venir par prestataire, 1 an maximum,
--   heures à la demi-heure (contraintes CHECK).
-- Ordre : appliquer cette migration AVANT de déployer blade-booking. (La fonction tolère malgré tout
--   l'absence des tables : aucun créneau pour les autres prestataires, pas d'erreur 500.)
--
-- Contrôle préalable : doit renvoyer 0 ligne.
--   SELECT 'deja present : ' || n FROM unnest(ARRAY['blade_provider_hours','blade_provider_date_overrides']) n
--   WHERE to_regclass('public.' || n) IS NOT NULL
--   UNION ALL
--   SELECT 'fonction absente : blade_my_provider_id' WHERE to_regprocedure('public.blade_my_provider_id()') IS NULL;
--
-- Retour arrière : 01_provider_hours.rollback.sql (renomme, ne supprime pas).

BEGIN;

CREATE TABLE public.blade_provider_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CONSTRAINT blade_provider_hours_day CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL CONSTRAINT blade_provider_hours_step CHECK (extract(minute FROM start_time) IN (0, 30) AND extract(second FROM start_time) = 0),
  end_time time NOT NULL CONSTRAINT blade_provider_hours_end_step CHECK (extract(minute FROM end_time) IN (0, 30) AND extract(second FROM end_time) = 0),
  mode text NOT NULL DEFAULT 'both' CONSTRAINT blade_provider_hours_mode CHECK (mode IN ('both','domicile','deplacement')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- "00:00" en fin = minuit.
  CONSTRAINT blade_provider_hours_range CHECK (end_time > start_time OR end_time = '00:00')
);
CREATE INDEX blade_provider_hours_provider ON public.blade_provider_hours (provider_id, day_of_week);

CREATE TABLE public.blade_provider_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_available boolean NOT NULL,
  start_time time CONSTRAINT blade_provider_overrides_step CHECK (start_time IS NULL OR (extract(minute FROM start_time) IN (0, 30) AND extract(second FROM start_time) = 0)),
  end_time time CONSTRAINT blade_provider_overrides_end_step CHECK (end_time IS NULL OR (extract(minute FROM end_time) IN (0, 30) AND extract(second FROM end_time) = 0)),
  mode text NOT NULL DEFAULT 'both' CONSTRAINT blade_provider_overrides_mode CHECK (mode IN ('both','domicile','deplacement')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Fermeture : sans heures. Ouverture spéciale : avec une plage valide.
  CONSTRAINT blade_provider_overrides_shape CHECK (
    (NOT is_available AND start_time IS NULL AND end_time IS NULL)
    OR (is_available AND start_time IS NOT NULL AND end_time IS NOT NULL AND (end_time > start_time OR end_time = '00:00')))
);
CREATE INDEX blade_provider_overrides_provider ON public.blade_provider_date_overrides (provider_id, date);

ALTER TABLE public.blade_provider_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blade_provider_date_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blade_provider_hours, public.blade_provider_date_overrides FROM anon, authenticated;
GRANT SELECT ON public.blade_provider_hours, public.blade_provider_date_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blade_provider_hours, public.blade_provider_date_overrides TO service_role;
CREATE POLICY "Providers read their own hours" ON public.blade_provider_hours
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = blade_provider_hours.provider_id AND p.user_id = auth.uid()));
CREATE POLICY "Providers read their own date overrides" ON public.blade_provider_date_overrides
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.blade_providers p WHERE p.id = blade_provider_date_overrides.provider_id AND p.user_id = auth.uid()));

CREATE FUNCTION public.blade_save_hours(p_rules jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); r jsonb; n integer := 0;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Données invalides'; END IF;
  IF jsonb_array_length(p_rules) > 42 THEN RAISE EXCEPTION 'Trop de plages horaires (42 au maximum)'; END IF;
  DELETE FROM public.blade_provider_hours WHERE provider_id = pid;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rules) LOOP
    BEGIN
      INSERT INTO public.blade_provider_hours(provider_id, day_of_week, start_time, end_time, mode)
      VALUES (pid, (r->>'day_of_week')::smallint, (r->>'start_time')::time, (r->>'end_time')::time, COALESCE(r->>'mode', 'both'));
    EXCEPTION WHEN check_violation OR invalid_datetime_format OR invalid_text_representation OR not_null_violation OR datetime_field_overflow OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Plage horaire invalide : vérifie le jour et les heures (par demi-heure : 09:00, 09:30…)';
    END;
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

CREATE FUNCTION public.blade_add_date_override(p_date date, p_closed boolean, p_start time DEFAULT NULL, p_end time DEFAULT NULL, p_mode text DEFAULT 'both')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id(); out uuid;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  IF p_closed IS NULL THEN RAISE EXCEPTION 'Données invalides'; END IF;
  IF p_date IS NULL OR p_date < CURRENT_DATE OR p_date > CURRENT_DATE + 366 THEN RAISE EXCEPTION 'Choisis une date dans les 12 prochains mois'; END IF;
  IF (SELECT count(*) FROM public.blade_provider_date_overrides WHERE provider_id = pid AND date >= CURRENT_DATE) >= 400 THEN
    RAISE EXCEPTION 'Trop d''exceptions à venir (400 au maximum)';
  END IF;
  -- Une fermeture remplace tout ce qui était prévu ce jour-là.
  IF p_closed THEN DELETE FROM public.blade_provider_date_overrides WHERE provider_id = pid AND date = p_date; END IF;
  BEGIN
    INSERT INTO public.blade_provider_date_overrides(provider_id, date, is_available, start_time, end_time, mode)
    VALUES (pid, p_date, NOT p_closed, CASE WHEN p_closed THEN NULL ELSE p_start END, CASE WHEN p_closed THEN NULL ELSE p_end END, COALESCE(p_mode, 'both'))
    RETURNING id INTO out;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Horaires invalides : heures par demi-heure, fin après le début';
  END;
  RETURN out;
END $function$;

CREATE FUNCTION public.blade_delete_date_override(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pid uuid := public.blade_my_provider_id();
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  DELETE FROM public.blade_provider_date_overrides WHERE id = p_id AND provider_id = pid;
  RETURN FOUND;
END $function$;

REVOKE ALL ON FUNCTION public.blade_save_hours(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blade_add_date_override(date, boolean, time, time, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blade_delete_date_override(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_save_hours(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.blade_add_date_override(date, boolean, time, time, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.blade_delete_date_override(uuid) TO authenticated, service_role;

COMMIT;
