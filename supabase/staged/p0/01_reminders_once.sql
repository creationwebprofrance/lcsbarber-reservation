-- P0 · Rappels de rendez-vous : un seul envoi par rappel et appel réservé à la tâche planifiée.
-- NON APPLIQUÉ. À appliquer après accord, dans cet ordre :
--   1. Créer le secret de fonction REMINDERS_CRON_SECRET (valeur aléatoire, jamais dans le chat ni dans Git).
--   2. Créer la même valeur dans Supabase Vault sous le nom 'reminders_cron_secret'
--      (Dashboard > Project Settings > Vault), pas dans ce fichier.
--   3. Appliquer ce fichier, puis déployer la fonction send-booking-reminders.
-- Retour arrière : 01_reminders_once.rollback.sql

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_day_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

-- Les rendez-vous déjà passés ne recevront jamais de rappel : on les marque pour ne rien renvoyer.
UPDATE public.bookings
   SET reminder_day_sent_at = COALESCE(reminder_day_sent_at, now()),
       reminder_2h_sent_at  = COALESCE(reminder_2h_sent_at, now())
 WHERE appointment_date < current_date;

-- La tâche planifiée envoie désormais l'en-tête x-cron-secret lu dans Vault (au lieu de la seule clé publique).
SELECT cron.unschedule('send-booking-reminders');
SELECT cron.schedule(
  'send-booking-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
