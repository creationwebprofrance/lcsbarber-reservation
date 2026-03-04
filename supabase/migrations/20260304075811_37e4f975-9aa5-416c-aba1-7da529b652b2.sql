
-- Create events table for managing multiple events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_hour time NOT NULL DEFAULT '09:00',
  end_hour time NOT NULL DEFAULT '20:00',
  prix_coupe_classique numeric DEFAULT 0,
  prix_coupe_barbe numeric DEFAULT 0,
  prix_barbe numeric DEFAULT 0,
  prix_contours numeric DEFAULT 0,
  excluded_services text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (is_admin());
