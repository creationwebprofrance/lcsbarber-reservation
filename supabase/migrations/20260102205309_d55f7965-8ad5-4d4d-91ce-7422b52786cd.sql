-- Fix pending_bookings INSERT policy (was restrictive)
DROP POLICY IF EXISTS "Anyone can create pending bookings" ON public.pending_bookings;

CREATE POLICY "Anyone can create pending bookings" 
ON public.pending_bookings 
FOR INSERT 
TO public
WITH CHECK (true);

-- Fix clients INSERT policy (was restrictive)
DROP POLICY IF EXISTS "Anyone can create clients" ON public.clients;

CREATE POLICY "Anyone can create clients" 
ON public.clients 
FOR INSERT 
TO public
WITH CHECK (true);

-- Fix reviews INSERT policy (was restrictive)
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.reviews;

CREATE POLICY "Anyone can create reviews" 
ON public.reviews 
FOR INSERT 
TO public
WITH CHECK (true);