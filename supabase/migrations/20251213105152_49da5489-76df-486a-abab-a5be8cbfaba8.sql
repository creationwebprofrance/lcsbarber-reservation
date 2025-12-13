-- Add same_day_fee setting to pricing_settings
INSERT INTO public.pricing_settings (setting_key, setting_value, description)
VALUES ('same_day_fee', 5, 'Frais supplémentaires pour réservation le jour même (€)')
ON CONFLICT (setting_key) DO NOTHING;