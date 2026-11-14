REVOKE EXECUTE ON FUNCTION public.blade_lcs_provider_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_my_provider_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_owns_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_owns_media(text) TO authenticated;