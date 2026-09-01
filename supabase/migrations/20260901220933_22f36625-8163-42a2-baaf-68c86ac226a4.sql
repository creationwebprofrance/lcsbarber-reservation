ALTER TABLE public.calendar_settings ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'both';
ALTER TABLE public.date_overrides ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'both';

CREATE OR REPLACE FUNCTION public.validate_slot_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode NOT IN ('both', 'domicile', 'deplacement') THEN
    RAISE EXCEPTION 'Invalid slot mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_calendar_settings_mode ON public.calendar_settings;
CREATE TRIGGER validate_calendar_settings_mode
BEFORE INSERT OR UPDATE ON public.calendar_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_slot_mode();

DROP TRIGGER IF EXISTS validate_date_overrides_mode ON public.date_overrides;
CREATE TRIGGER validate_date_overrides_mode
BEFORE INSERT OR UPDATE ON public.date_overrides
FOR EACH ROW EXECUTE FUNCTION public.validate_slot_mode();