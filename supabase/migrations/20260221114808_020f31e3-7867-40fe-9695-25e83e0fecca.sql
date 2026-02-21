
-- Table pour stocker les paramètres du Carnaval de Bordeaux
CREATE TABLE public.carnaval_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.carnaval_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage carnaval settings" ON public.carnaval_settings FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view carnaval settings" ON public.carnaval_settings FOR SELECT USING (true);

-- Données initiales
INSERT INTO public.carnaval_settings (setting_key, setting_value, description) VALUES
  ('enabled', 'true', 'Activer/désactiver la page Carnaval'),
  ('start_date', '2026-02-26', 'Date de début du Carnaval'),
  ('end_date', '2026-03-02', 'Date de fin du Carnaval'),
  ('prix_coupe_classique', '15', 'Prix Carnaval - Coupe classique'),
  ('prix_coupe_barbe', '20', 'Prix Carnaval - Coupe + barbe'),
  ('prix_barbe', '10', 'Prix Carnaval - Barbe uniquement'),
  ('prix_contours', '10', 'Prix Carnaval - Contours'),
  ('excluded_services', 'Coupe enfant', 'Services exclus (séparés par des virgules)');
