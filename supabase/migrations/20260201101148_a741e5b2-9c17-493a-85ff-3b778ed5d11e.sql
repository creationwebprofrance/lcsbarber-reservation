-- Add Sunday fee to pricing settings
INSERT INTO public.pricing_settings (setting_key, setting_value, description)
VALUES ('sunday_fee', 10, 'Supplément pour les réservations le dimanche (en euros)')
ON CONFLICT (setting_key) DO NOTHING;