ALTER VIEW public.public_reviews SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_pending_bookings() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_booking_from_pending(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.make_user_admin(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_slot_mode() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_bookings() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_booking_from_pending(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.make_user_admin(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;