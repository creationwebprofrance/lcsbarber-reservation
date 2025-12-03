-- Ajouter le dimanche dans les paramètres du calendrier
INSERT INTO public.calendar_settings (day_of_week, start_time, end_time, is_available)
VALUES (0, '09:00:00', '20:00:00', true);