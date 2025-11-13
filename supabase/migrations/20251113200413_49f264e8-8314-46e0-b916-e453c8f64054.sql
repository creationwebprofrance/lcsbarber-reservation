-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Only verified pending bookings can create bookings" ON public.bookings;

-- Create a new policy that allows anyone to create bookings
CREATE POLICY "Anyone can create bookings"
ON public.bookings
FOR INSERT
WITH CHECK (true);