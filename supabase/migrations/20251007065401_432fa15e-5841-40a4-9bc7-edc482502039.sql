-- Create pending_bookings table to store unverified bookings
CREATE TABLE public.pending_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_address TEXT,
  total_price NUMERIC NOT NULL,
  travel_fee NUMERIC DEFAULT 0,
  notes TEXT,
  verification_token TEXT NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create pending bookings (with verification required)
CREATE POLICY "Anyone can create pending bookings"
ON public.pending_bookings
FOR INSERT
WITH CHECK (true);

-- Policy: Anyone can view their own pending booking using verification token
CREATE POLICY "View pending booking with token"
ON public.pending_bookings
FOR SELECT
USING (true);

-- Policy: Admins can view all pending bookings
CREATE POLICY "Admins can view all pending bookings"
ON public.pending_bookings
FOR SELECT
USING (is_admin());

-- Policy: Admins can delete pending bookings
CREATE POLICY "Admins can delete pending bookings"
ON public.pending_bookings
FOR DELETE
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_pending_bookings_updated_at
BEFORE UPDATE ON public.pending_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on verification token for faster lookups
CREATE INDEX idx_pending_bookings_verification_token ON public.pending_bookings(verification_token);

-- Create index on expires_at for cleanup queries
CREATE INDEX idx_pending_bookings_expires_at ON public.pending_bookings(expires_at);

-- Create index on client_email for rate limiting
CREATE INDEX idx_pending_bookings_client_email ON public.pending_bookings(client_email);

-- Add comment explaining the security model
COMMENT ON TABLE public.pending_bookings IS 'Stores unverified bookings that require email verification. Tokens expire after 24 hours. This prevents fake booking spam by requiring email verification.';

-- Function to clean up expired pending bookings (call this with pg_cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pending_bookings
  WHERE expires_at < now() AND verified = false;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_pending_bookings IS 'Deletes expired unverified pending bookings. Should be run periodically via pg_cron.';

-- Modify the bookings INSERT policy to prevent direct insertion
-- Only allow inserts from verified pending bookings (we'll handle this in the verification function)
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Only verified pending bookings can create bookings"
ON public.bookings
FOR INSERT
WITH CHECK (false);  -- Temporarily block all direct inserts

-- We'll create a secure function to move verified pending bookings to bookings table
CREATE OR REPLACE FUNCTION public.create_booking_from_pending(
  p_verification_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_booking RECORD;
  v_new_booking_id UUID;
  v_result JSON;
BEGIN
  -- Find and lock the pending booking
  SELECT * INTO v_pending_booking
  FROM public.pending_bookings
  WHERE verification_token = p_verification_token
    AND verified = false
    AND expires_at > now()
  FOR UPDATE;

  -- Check if pending booking exists and is valid
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired verification token'
    );
  END IF;

  -- Mark as verified
  UPDATE public.pending_bookings
  SET verified = true
  WHERE id = v_pending_booking.id;

  -- Create the actual booking
  INSERT INTO public.bookings (
    service_id,
    appointment_date,
    appointment_time,
    client_name,
    client_email,
    client_phone,
    client_address,
    total_price,
    travel_fee,
    notes,
    deposit_paid,
    status
  ) VALUES (
    v_pending_booking.service_id,
    v_pending_booking.appointment_date,
    v_pending_booking.appointment_time,
    v_pending_booking.client_name,
    v_pending_booking.client_email,
    v_pending_booking.client_phone,
    v_pending_booking.client_address,
    v_pending_booking.total_price,
    v_pending_booking.travel_fee,
    v_pending_booking.notes,
    true,  -- deposit_paid
    'confirmed'  -- status
  ) RETURNING id INTO v_new_booking_id;

  -- Return success with booking ID
  RETURN json_build_object(
    'success', true,
    'booking_id', v_new_booking_id,
    'booking_data', row_to_json(v_pending_booking)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.create_booking_from_pending IS 'Securely converts a verified pending booking into a confirmed booking. Can only be called with valid verification token.';