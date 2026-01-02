-- Drop and recreate the INSERT policy for bookings with explicit roles
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Anyone can create bookings" 
ON public.bookings 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also fix pending_bookings
DROP POLICY IF EXISTS "Anyone can create pending bookings" ON public.pending_bookings;

CREATE POLICY "Anyone can create pending bookings" 
ON public.pending_bookings 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- And clients
DROP POLICY IF EXISTS "Anyone can create clients" ON public.clients;

CREATE POLICY "Anyone can create clients" 
ON public.clients 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);