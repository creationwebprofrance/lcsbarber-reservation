-- Add policy to allow clients to view their own bookings based on email
CREATE POLICY "Clients can view their own bookings"
ON public.bookings
FOR SELECT
USING (client_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR client_email = auth.email());

-- Add comment explaining the security model
COMMENT ON POLICY "Clients can view their own bookings" ON public.bookings IS 
'Allows authenticated users to view bookings that match their email address. Unauthenticated users cannot view any bookings.';