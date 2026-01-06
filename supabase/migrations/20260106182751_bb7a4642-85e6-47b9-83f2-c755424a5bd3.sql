-- Supprimer la contrainte d'unicité qui empêche plusieurs créneaux par jour
ALTER TABLE public.calendar_settings DROP CONSTRAINT IF EXISTS calendar_settings_day_of_week_start_time_key;