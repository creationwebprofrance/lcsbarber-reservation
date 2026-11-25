-- Retour arrière de 01_cron_timeout.sql : remet à l'identique les commandes d'origine des jobs 2 et 3
-- (délai pg_net par défaut de 5 s). Le jobid 3 avait des fins de ligne CRLF : elles sont recréées
-- pour retrouver la même empreinte md5 (f0f3df6888138f3f6dd1dec11d75705d).

BEGIN;

DO $r$
BEGIN
  -- Garde : ne remet les commandes d'origine que si les jobs portent encore celles posées par la migration.
  IF (SELECT md5(command) FROM cron.job WHERE jobid = 2) IS DISTINCT FROM 'd648bd88eecee73aeaf5307a01dea15b'
  OR (SELECT md5(command) FROM cron.job WHERE jobid = 3) IS DISTINCT FROM '42e7e3234eb4ae8ac5370d35dc3d3e45' THEN
    RAISE EXCEPTION 'Job cron modifié depuis la migration : retour arrière annulé, faire reprendre par Dédale';
  END IF;

  PERFORM cron.alter_job(job_id := 2, command := $c$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/blade-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $c$);

  PERFORM cron.alter_job(job_id := 3, command := replace(replace($c$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $c$, E'\r\n', E'\n'), E'\n', E'\r\n'));
END $r$;

COMMIT;
