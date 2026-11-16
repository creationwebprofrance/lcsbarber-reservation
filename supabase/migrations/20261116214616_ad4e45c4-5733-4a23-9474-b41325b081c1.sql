REVOKE ALL ON public.blade_subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.blade_subscriptions FROM authenticated;
GRANT SELECT ON public.blade_subscriptions TO authenticated;
GRANT ALL ON public.blade_subscriptions TO service_role;