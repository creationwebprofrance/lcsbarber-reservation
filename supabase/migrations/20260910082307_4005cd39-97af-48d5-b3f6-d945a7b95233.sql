ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS drivetrain text,
  ADD COLUMN IF NOT EXISTS doors integer,
  ADD COLUMN IF NOT EXISTS seats integer,
  ADD COLUMN IF NOT EXISTS hybrid_type text,
  ADD COLUMN IF NOT EXISTS trim_level text,
  ADD COLUMN IF NOT EXISTS consumption_l_100km numeric,
  ADD COLUMN IF NOT EXISTS fuel_price_per_l numeric,
  ADD COLUMN IF NOT EXISTS consumption_kwh_100km numeric,
  ADD COLUMN IF NOT EXISTS elec_price_per_kwh numeric;