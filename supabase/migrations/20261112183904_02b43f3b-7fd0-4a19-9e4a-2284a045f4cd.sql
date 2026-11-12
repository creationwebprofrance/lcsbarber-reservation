CREATE OR REPLACE FUNCTION public.blade_cancel_booking(p_booking uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  SELECT provider_id INTO pid FROM public.bookings WHERE id=p_booking;
  IF pid IS NULL OR NOT public.blade_owns_provider(pid) THEN RAISE EXCEPTION 'Rendez-vous introuvable'; END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking AND status IN ('pending','confirmed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Ce rendez-vous ne peut plus être annulé'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.blade_cancel_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_cancel_booking(uuid) TO authenticated;