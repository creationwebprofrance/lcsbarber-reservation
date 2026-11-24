-- Trajets · purge automatique de public.blade_trips 7 jours après le rendez-vous.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : RGPD, limitation de la conservation (article 5.1.e). blade_trips contient l'itinéraire
--   estimé (route) et `dest`, les coordonnées du lieu de la prestation. Décision de l'utilisateur :
--   conserver un trajet 7 jours après la date du rendez-vous, puis le supprimer.
-- Ce que fait le fichier :
--   1. crée public.blade_purge_old_trips() (SECURITY DEFINER, search_path = public), qui supprime les
--      trajets dont le rendez-vous (bookings.appointment_date) est antérieur à « aujourd'hui à Paris
--      moins 7 jours », ou, à défaut de rendez-vous, créés il y a plus de 7 jours ; elle renvoie
--      seulement le nombre de lignes supprimées. Exécutable uniquement par postgres et service_role.
--   2. planifie le job pg_cron « blade-purge-old-trips » tous les jours à 03:15 UTC (04:15 ou 05:15
--      à Paris), sur le modèle de blade-daily et send-booking-reminders (mais sans appel HTTP ni secret).
-- Risques :
--   - Les lignes supprimées ne sont pas récupérables (hors sauvegarde Supabase). Le lien public de
--     suivi (blade_trip_public) d'un trajet purgé ne renvoie plus rien : c'est voulu.
--   - « Aujourd'hui » est calculé en heure de Paris (comme blade_my_trips) ; à 03:15 UTC, cela donne
--     la même date que current_date. Un rendez-vous du jour J est purgé la nuit du J+8.
--   - Le DELETE ne touche que blade_trips (aucune table ne dépend d'elle) ; bookings n'est pas modifiée.
-- Contrôle préalable (nombre seulement, aucune donnée personnelle) : nombre de trajets qui seront
-- supprimés au premier passage. Le relire avant d'appliquer ; s'il est inattendu, ne pas appliquer.
--
--   SELECT count(*) AS trajets_a_purger
--   FROM public.blade_trips t
--   LEFT JOIN public.bookings b ON b.id = t.booking_id
--   WHERE (b.id IS NOT NULL AND b.appointment_date < (now() AT TIME ZONE 'Europe/Paris')::date - 7)
--      OR (b.id IS NULL AND t.created_at < now() - interval '7 days');
--
-- Retour arrière : 01_blade_trips_purge.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.blade_purge_old_trips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.blade_trips t
  WHERE EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = t.booking_id
            AND b.appointment_date < (now() AT TIME ZONE 'Europe/Paris')::date - 7
        )
     OR (
          NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = t.booking_id)
          AND t.created_at < now() - interval '7 days'
        );
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$fn$;

COMMENT ON FUNCTION public.blade_purge_old_trips() IS
  'RGPD : supprime les trajets (blade_trips) 7 jours après le rendez-vous. Appelée chaque jour par pg_cron (blade-purge-old-trips).';

REVOKE ALL ON FUNCTION public.blade_purge_old_trips() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_purge_old_trips() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blade_purge_old_trips() TO service_role;

-- Job quotidien : on retire d'abord un éventuel job du même nom (idempotent).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blade-purge-old-trips';
SELECT cron.schedule(
  'blade-purge-old-trips',
  '15 3 * * *',
  $$SELECT public.blade_purge_old_trips();$$
);

COMMIT;
