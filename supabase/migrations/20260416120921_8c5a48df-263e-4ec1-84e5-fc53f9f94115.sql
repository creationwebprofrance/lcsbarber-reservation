CREATE TABLE public.prestations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  prestation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prestations"
ON public.prestations FOR ALL
USING (is_admin());

CREATE POLICY "Admins can view prestations"
ON public.prestations FOR SELECT
USING (is_admin());