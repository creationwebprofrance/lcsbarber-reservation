-- Retour arrière de 01_reminders_once.sql : redéployer d'abord l'ancienne fonction
-- (git checkout main -- supabase/functions/send-booking-reminders && npm run fn:deploy -- send-booking-reminders),
-- puis rétablir l'ancienne tâche planifiée. Les colonnes ajoutées sont conservées (sans effet sur l'ancien code).
SELECT cron.unschedule('send-booking-reminders');
SELECT cron.schedule(
  'send-booking-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
