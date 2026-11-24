-- P0 · Isolation : l'admin LCS ne voit plus que les lignes de SES prestataires actifs (blade_owns_provider).
-- NON APPLIQUÉ ET INUTILE (test du 24/11/2026, scripts/test-rls-isolation.mjs) : les politiques RESTRICTIVE « Blade scoped » isolent déjà les prestataires.
-- Généré depuis pg_policies (12 politiques, 7 tables), en ne regardant que les politiques PERMISSIVE.
-- le dashboard LCS doit garder 189 réservations, 93 clients, 5 services. Retour arrière : 02_rls_provider_isolation.rollback.sql
-- Hors périmètre (pas de colonne provider_id) : pending_bookings, reviews, profiles, artists, events... à traiter ensuite.
BEGIN;
DROP POLICY "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings AS PERMISSIVE FOR DELETE TO authenticated USING ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can update bookings" ON public.bookings;
CREATE POLICY "Admins can update bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage client merges" ON public.client_merges;
CREATE POLICY "Admins can manage client merges" ON public.client_merges AS PERMISSIVE FOR ALL TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can view client merges" ON public.client_merges;
CREATE POLICY "Admins can view client merges" ON public.client_merges AS PERMISSIVE FOR SELECT TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage clients" ON public.clients;
CREATE POLICY "Admins can manage clients" ON public.clients AS PERMISSIVE FOR ALL TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage email templates" ON public.email_templates;
CREATE POLICY "Admins can manage email templates" ON public.email_templates AS PERMISSIVE FOR ALL TO authenticated USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can view email templates" ON public.email_templates;
CREATE POLICY "Admins can view email templates" ON public.email_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage prestations" ON public.prestations;
CREATE POLICY "Admins can manage prestations" ON public.prestations AS PERMISSIVE FOR ALL TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can view prestations" ON public.prestations;
CREATE POLICY "Admins can view prestations" ON public.prestations AS PERMISSIVE FOR SELECT TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage pricing settings" ON public.pricing_settings;
CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings AS PERMISSIVE FOR ALL TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
DROP POLICY "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services" ON public.services AS PERMISSIVE FOR ALL TO public USING ((public.is_admin() AND public.blade_owns_provider(provider_id))) WITH CHECK ((public.is_admin() AND public.blade_owns_provider(provider_id)));
COMMIT;
