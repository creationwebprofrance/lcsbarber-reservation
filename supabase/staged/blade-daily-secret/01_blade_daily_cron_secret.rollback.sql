-- ORDRE OBLIGATOIRE : si la nouvelle fonction blade-daily (qui exige x-cron-secret) est déjà
--   déployée, REDÉPLOYER D'ABORD l'ancienne fonction, puis appliquer ce fichier. Sinon le job,
--   qui n'enverra plus x-cron-secret, recevra 401 chaque matin.
--
-- Retour arrière de 01_blade_daily_cron_secret.sql : remet la commande précédente du job
-- « blade-daily » (en-tête Content-Type, corps {}), même jobid, même horaire 0 7 * * *.
--
-- Écart volontaire avec la commande d'origine : l'en-tête apikey (JWT anon en dur) n'est PAS remis.
--   - La clé anon n'est pas dans Vault (seul 'reminders_cron_secret' y figure, vérifié le
--     2026-11-24) : impossible de la relire sans la recopier en clair dans ce fichier.
--   - blade-daily a verify_jwt = false (supabase/config.toml) : la passerelle n'exige pas de JWT et
--     l'ancienne fonction ne lit pas apikey. La requête sans apikey se comporte donc comme avant.
--   - Si un jour la clé anon est ajoutée à Vault, on pourra la relire ici comme x-cron-secret.
--
-- Retour arrière du retour arrière : réappliquer 01_blade_daily_cron_secret.sql.

BEGIN;

DO $r$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'blade-daily';
  IF jid IS NULL THEN
    RAISE EXCEPTION 'job blade-daily introuvable : rien n''est modifié';
  END IF;

  PERFORM cron.alter_job(
    job_id  := jid,
    command := $cmd$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/blade-daily',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
  );
END
$r$;

COMMIT;
