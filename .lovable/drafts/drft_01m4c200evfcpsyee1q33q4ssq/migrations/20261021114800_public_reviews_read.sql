-- Public, email-free read of reviews for visitors (base table stays admin-only).
CREATE OR REPLACE FUNCTION public.get_public_reviews()
RETURNS TABLE (id uuid, client_name text, rating integer, comment text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id, client_name, rating, comment, created_at FROM public.reviews ORDER BY created_at DESC LIMIT 50 $$;
GRANT EXECUTE ON FUNCTION public.get_public_reviews() TO anon, authenticated;
