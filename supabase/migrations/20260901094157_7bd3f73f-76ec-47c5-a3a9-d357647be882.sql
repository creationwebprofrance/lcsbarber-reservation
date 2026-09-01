CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());