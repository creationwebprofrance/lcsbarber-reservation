-- ORDRE OBLIGATOIRE : appliquer CE FICHIER AVANT de déployer la nouvelle fonction blade-daily.
--   1. Appliquer ce fichier (le job envoie désormais x-cron-secret).
--   2. Seulement ensuite, déployer blade-daily (qui exigera x-cron-secret).
--   L'ancienne fonction déployée ignore l'en-tête en trop : cet ordre ne casse rien.
--   L'ordre inverse ferait échouer le job de 07:00 UTC (401) jusqu'à l'application de ce fichier.
--
-- blade-daily · le job pg_cron envoie l'en-tête x-cron-secret lu dans Vault, sans JWT en dur.
-- NON APPLIQUÉ. À appliquer après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : la commande actuelle du job « blade-daily » (0 7 * * *) porte en clair, dans
--   cron.job, un JWT apikey (rôle anon, vérifié le 2026-11-24 sans afficher la clé), et la fonction
--   va exiger l'en-tête x-cron-secret (même valeur que le secret de fonction REMINDERS_CRON_SECRET).
--   Modèle : job send-booking-reminders (supabase/staged/p0/01_reminders_once.sql).
-- Ce que fait le fichier : cron.alter_job remplace UNIQUEMENT la commande du job (même jobid, même
--   nom, même horaire, toujours actif). Le secret est lu dans vault.decrypted_secrets
--   (nom 'reminders_cron_secret') à chaque exécution, jamais recopié dans cron.job. Plus d'apikey :
--   blade-daily a verify_jwt = false (supabase/config.toml), la clé n'est donc pas nécessaire.
-- Risques :
--   - Si le secret Vault 'reminders_cron_secret' diffère de REMINDERS_CRON_SECRET, la nouvelle
--     fonction répondra 401 : c'est déjà la valeur utilisée par send-booking-reminders.
--   - La fonction en échec ne bloque rien d'autre ; voir net._http_response après 07:00 UTC.
-- Contrôle préalable : doit renvoyer 0 ligne avant d'appliquer (sinon, ne pas appliquer).
--
--   SELECT 'job blade-daily absent ou horaire inattendu' AS probleme
--   WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'blade-daily' AND schedule = '0 7 * * *')
--   UNION ALL
--   SELECT 'secret Vault reminders_cron_secret absent'
--   WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret'
--                       AND coalesce(decrypted_secret, '') <> '');
--
-- Retour arrière : 01_blade_daily_cron_secret.rollback.sql

BEGIN;

DO $m$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'blade-daily';
  IF jid IS NULL THEN
    RAISE EXCEPTION 'job blade-daily introuvable : rien n''est modifié';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret' AND coalesce(decrypted_secret, '') <> '') THEN
    RAISE EXCEPTION 'secret Vault reminders_cron_secret absent ou vide : rien n''est modifié';
  END IF;

  PERFORM cron.alter_job(
    job_id  := jid,
    command := $cmd$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/blade-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
  );
END
$m$;

COMMIT;
