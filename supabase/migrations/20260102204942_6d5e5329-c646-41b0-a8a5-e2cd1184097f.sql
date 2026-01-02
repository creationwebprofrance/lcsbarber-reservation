-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Anyone can create bookings" 
ON public.bookings 
FOR INSERT 
TO public
WITH CHECK (true);