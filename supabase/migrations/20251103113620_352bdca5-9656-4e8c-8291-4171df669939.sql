-- Recreate the view with SECURITY INVOKER to use querying user's permissions
DROP VIEW IF EXISTS public.public_reviews;

CREATE VIEW public.public_reviews 
WITH (security_invoker = true)
AS
SELECT 
  id,
  client_name,
  booking_id,
  rating,
  comment,
  created_at,
  updated_at
FROM public.reviews;