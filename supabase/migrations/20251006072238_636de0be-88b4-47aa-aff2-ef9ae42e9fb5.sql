-- Activer les extensions nécessaires pour les cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Créer un cron job qui s'exécute toutes les 30 minutes
-- pour vérifier et envoyer les rappels de rendez-vous
SELECT cron.schedule(
  'send-booking-reminders',
  '*/30 * * * *', -- Toutes les 30 minutes
  $$
  SELECT
    net.http_post(
      url:='https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/send-booking-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndGJlZHZweHBhZHBxeHJrenp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzA1NjMsImV4cCI6MjA3NDEwNjU2M30.hxSXPVkcDcaY8Siv8RQcg1KyExDxBgaOP-qEtWtL_Vc"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);