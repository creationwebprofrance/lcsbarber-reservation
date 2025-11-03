-- Create a public view that excludes sensitive email data
CREATE OR REPLACE VIEW public.public_reviews AS
SELECT 
  id,
  client_name,
  booking_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;

-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

-- Add restricted policy - only admins can view full reviews table
CREATE POLICY "Only admins can view full reviews"
ON public.reviews
FOR SELECT
USING (is_admin());

-- Grant public SELECT on the view (views don't use RLS by default)
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;