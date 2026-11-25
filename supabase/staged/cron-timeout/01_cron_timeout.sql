-- Tâches pg_cron blade-daily (jobid 2) et send-booking-reminders (jobid 3) : délai d'attente de 30 s.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : net.http_post attend 5 s par défaut. blade-daily répond en ~6 s : l'appel aboutit
--   (journal de la fonction : 200), mais net._http_response enregistre « timeout » au lieu du code
--   et du contenu de la réponse. Avec 30 s, le vrai résultat est conservé et contrôlable.
-- Ce que fait le fichier : cron.alter_job remplace UNIQUEMENT la commande des deux jobs (mêmes jobid,
--   noms, horaires, toujours actifs). La seule différence est l'argument
--   timeout_milliseconds := 30000. Le secret reste lu dans Vault à chaque exécution.
-- Risques : aucun sur les fonctions appelées. Une requête pg_net occupe au plus 30 s au lieu de 5 s
--   (2 jobs, au plus 1 appel par demi-heure pour les rappels).
-- Contrôle préalable : le bloc ci-dessous s'arrête si une commande a changé depuis la préparation
--   (empreintes md5 du 2026-11-25) ou si un horaire n'est pas celui attendu.
-- Retour arrière : 01_cron_timeout.rollback.sql (remet les commandes d'origine à l'identique).

BEGIN;

DO $m$
BEGIN
  IF (SELECT md5(command) FROM cron.job WHERE jobid = 2 AND jobname = 'blade-daily' AND schedule = '0 7 * * *') IS DISTINCT FROM 'a6f2e26a2e9e00672e7cd73dc425d17c'
  OR (SELECT md5(command) FROM cron.job WHERE jobid = 3 AND jobname = 'send-booking-reminders' AND schedule = '*/30 * * * *') IS DISTINCT FROM 'f0f3df6888138f3f6dd1dec11d75705d' THEN
    RAISE EXCEPTION 'Job cron modifié depuis la préparation : ne pas appliquer, faire reprendre par Dédale';
  END IF;

  PERFORM cron.alter_job(job_id := 2, command := $c$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/blade-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $c$);

  PERFORM cron.alter_job(job_id := 3, command := $c$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $c$);
END $m$;

COMMIT;
