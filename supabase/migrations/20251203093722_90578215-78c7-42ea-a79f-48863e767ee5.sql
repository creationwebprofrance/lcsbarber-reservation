-- Table pour les paramètres de tarification
CREATE TABLE public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value numeric NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view pricing settings" 
ON public.pricing_settings FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage pricing settings" 
ON public.pricing_settings FOR ALL 
USING (is_admin());

-- Insert default settings
-- Frais de déplacement
INSERT INTO public.pricing_settings (setting_key, setting_value, description) VALUES
('travel_free_minutes', 20, 'Minutes gratuites avant facturation des frais de déplacement'),
('travel_interval_minutes', 20, 'Intervalle de minutes pour chaque tranche de frais'),
('travel_fee_per_interval', 10, 'Prix en euros par tranche de temps'),
-- Suppléments horaires
('early_hour_threshold', 10, 'Heure avant laquelle le supplément tôt le matin s''applique'),
('early_hour_fee', 5, 'Supplément en euros par heure avant le seuil tôt'),
('late_hour_threshold', 20, 'Heure à partir de laquelle le supplément tard le soir s''applique'),
('late_hour_fee', 5, 'Supplément en euros par heure après le seuil tard');

-- Trigger for updated_at
CREATE TRIGGER update_pricing_settings_updated_at
  BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();