-- Remove permissive public SELECT policy that exposed client emails
DROP POLICY IF EXISTS "Public can read reviews via view" ON public.reviews;

-- Switch the public view to security_definer so anon can read it
-- without needing direct SELECT permission on reviews
ALTER VIEW public.public_reviews SET (security_invoker = false);