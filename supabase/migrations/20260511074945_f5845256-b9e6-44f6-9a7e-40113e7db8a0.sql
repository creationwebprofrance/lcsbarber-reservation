
-- 1. Drop orphaned time_slots table (never queried by app)
DROP TABLE IF EXISTS public.time_slots CASCADE;

-- 2. Restrict email_templates SELECT to admins (edge functions use service role anyway)
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_templates;
CREATE POLICY "Admins can view email templates"
ON public.email_templates FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3. Tighten always-true INSERT policies
-- bookings: public form goes through edge function (service role); admin uses is_admin policy.
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

-- pending_bookings: legacy, no client path remains
DROP POLICY IF EXISTS "Anyone can create pending bookings" ON public.pending_bookings;

-- clients: only admin code inserts; edge function uses service role
DROP POLICY IF EXISTS "Anyone can create clients" ON public.clients;

-- reviews: keep public insert but restrict shape
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.reviews;
CREATE POLICY "Anyone can create valid reviews"
ON public.reviews FOR INSERT
TO anon, authenticated
WITH CHECK (
  rating BETWEEN 1 AND 5
  AND char_length(client_name) BETWEEN 1 AND 100
  AND char_length(client_email) BETWEEN 3 AND 255
  AND (comment IS NULL OR char_length(comment) <= 2000)
);

-- 4. Recreate public_reviews view with security_invoker (avoid SECURITY DEFINER view)
DROP VIEW IF EXISTS public.public_reviews;
CREATE VIEW public.public_reviews
WITH (security_invoker = true) AS
SELECT id, client_name, rating, comment, booking_id, created_at, updated_at
FROM public.reviews;
GRANT SELECT ON public.public_reviews TO anon, authenticated;

-- Allow public SELECT on the underlying view via reviews table policy (limited columns through view)
CREATE POLICY "Public can read reviews via view"
ON public.reviews FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Restrict artist-photos bucket listing (keep public read by id, block listing)
-- The bucket stays public (objects accessible by URL) but disallow listing all files.
DROP POLICY IF EXISTS "Public can list artist-photos" ON storage.objects;
