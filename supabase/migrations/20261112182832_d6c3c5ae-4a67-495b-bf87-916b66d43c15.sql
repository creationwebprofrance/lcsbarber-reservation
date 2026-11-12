CREATE TABLE public.slot_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  client_name text NOT NULL CHECK (length(client_name) BETWEEN 2 AND 100),
  client_email text NOT NULL CHECK (length(client_email) <= 255),
  mode text NOT NULL CHECK (mode IN ('domicile', 'deplacement')),
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  message text NOT NULL DEFAULT '' CHECK (length(message) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  email_error text
);
GRANT SELECT ON public.slot_requests TO authenticated;
GRANT ALL ON public.slot_requests TO service_role;
ALTER TABLE public.slot_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads slot requests" ON public.slot_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX slot_requests_created_at_idx ON public.slot_requests (created_at DESC);
CREATE INDEX slot_requests_user_created_idx ON public.slot_requests (user_id, created_at DESC);

CREATE FUNCTION public.create_blade_slot_request(
  p_id uuid, p_user_id uuid, p_name text, p_email text, p_mode text,
  p_date date, p_time time, p_message text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT user_id INTO existing_user FROM public.slot_requests WHERE id = p_id;
  IF FOUND THEN
    IF existing_user <> p_user_id THEN RAISE EXCEPTION 'Request id conflict'; END IF;
    RETURN p_id;
  END IF;
  IF p_date < (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'Choose a current or future date';
  END IF;
  IF (SELECT count(*) FROM public.slot_requests WHERE user_id = p_user_id
      AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many requests';
  END IF;
  INSERT INTO public.slot_requests(id,user_id,client_name,client_email,mode,requested_date,requested_time,message)
  VALUES(p_id,p_user_id,trim(p_name),lower(trim(p_email)),p_mode,p_date,p_time,trim(p_message));
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_blade_slot_request(uuid,uuid,text,text,text,date,time,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_blade_slot_request(uuid,uuid,text,text,text,date,time,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_reviews()
RETURNS TABLE (id uuid, client_name text, rating integer, comment text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id, client_name, rating, comment, created_at FROM public.reviews ORDER BY created_at DESC LIMIT 50 $$;
GRANT EXECUTE ON FUNCTION public.get_public_reviews() TO anon, authenticated;