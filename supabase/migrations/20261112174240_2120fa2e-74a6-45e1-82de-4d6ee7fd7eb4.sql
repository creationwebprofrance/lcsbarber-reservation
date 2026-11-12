DROP POLICY IF EXISTS "Anyone can view calendar settings" ON public.calendar_settings;
CREATE POLICY "Signed-in users can view calendar settings" ON public.calendar_settings
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view date overrides" ON public.date_overrides;
CREATE POLICY "Signed-in users can view upcoming date overrides" ON public.date_overrides
FOR SELECT TO authenticated
USING (date >= (current_date - 1) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view carnaval settings" ON public.carnaval_settings;
CREATE POLICY "Public can view public carnaval settings" ON public.carnaval_settings
FOR SELECT TO anon, authenticated
USING (setting_key NOT LIKE 'private\_%' OR public.has_role(auth.uid(), 'admin'));