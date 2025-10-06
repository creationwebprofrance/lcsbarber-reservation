-- Nouvelle table pour gérer plusieurs créneaux horaires par jour
CREATE TABLE public.time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage time slots" 
ON public.time_slots 
FOR ALL 
USING (is_admin());

CREATE POLICY "Anyone can view time slots" 
ON public.time_slots 
FOR SELECT 
USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_time_slots_updated_at
BEFORE UPDATE ON public.time_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrer les données existantes de calendar_settings vers time_slots
INSERT INTO public.time_slots (day_of_week, start_time, end_time, is_available)
SELECT day_of_week, start_time, end_time, is_available
FROM public.calendar_settings;

-- Note: On garde calendar_settings pour compatibilité mais time_slots est la nouvelle référence