-- 1. Empêche un utilisateur de modifier son propre rôle dans profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 2. Les trajets ne sont accessibles qu'au propriétaire du véhicule (admin inclus)
DROP POLICY IF EXISTS "Admins manage trip legs" ON public.vehicle_trip_legs;
CREATE POLICY "Owners manage trip legs"
ON public.vehicle_trip_legs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vehicle_trips t
    JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE t.id = vehicle_trip_legs.trip_id
      AND v.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vehicle_trips t
    JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE t.id = vehicle_trip_legs.trip_id
      AND v.owner_id = auth.uid()
  )
);