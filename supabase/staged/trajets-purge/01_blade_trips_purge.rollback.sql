-- Retour arrière de 01_blade_trips_purge.sql : retire le job pg_cron puis la fonction.
-- ATTENTION : les trajets déjà supprimés par la purge ne sont PAS récupérables par ce fichier
-- (seule une restauration de sauvegarde Supabase les ramènerait). Ce retour arrière arrête
-- seulement les suppressions futures ; la politique de confidentialité devra alors être corrigée.

BEGIN;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blade-purge-old-trips';
DROP FUNCTION IF EXISTS public.blade_purge_old_trips();

COMMIT;
