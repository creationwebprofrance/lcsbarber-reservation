-- Superadmin : nombre de prestations honorées par prestataire, par client et au total.
-- Honorée = marquée terminée, ou confirmée et dont la date est passée.
CREATE OR REPLACE FUNCTION public.blade_booking_honored(b public.bookings)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT b.status = 'completed' OR (b.status = 'confirmed' AND b.appointment_date < current_date)
$$;

CREATE OR REPLACE FUNCTION public.blade_admin_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin'; END IF;
  RETURN jsonb_build_object(
    'providers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'display_name',p.display_name,'email',p.email,'status',p.status,'created_at',p.created_at,'validated_at',p.validated_at,
        'last_active_at',p.last_active_at,'opt_payment_links',p.opt_payment_links,'opt_auto_emails',p.opt_auto_emails,'opt_searchable',p.opt_searchable,
        'has_revolut',p.revolut_url IS NOT NULL,'has_stripe_link',p.stripe_link_url IS NOT NULL,'is_self',p.user_id=auth.uid(),
        'clients',(SELECT count(*) FROM public.clients c WHERE c.provider_id=p.id),
        'bookings',(SELECT count(*) FROM public.bookings b WHERE b.provider_id=p.id),
        -- Les rendez-vous historiques de LCS Barber (sans prestataire) comptent pour le compte superadmin.
        'honored',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)
                    AND (b.provider_id=p.id OR (b.provider_id IS NULL AND p.user_id=auth.uid()))))
      ORDER BY p.created_at) FROM public.blade_providers p),'[]'::jsonb),
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'created_at',c.created_at,
        'provider_id',c.provider_id,'provider_name',p.display_name,
        'honored',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)
                    AND (b.client_id=c.id OR (b.client_id IS NULL AND lower(b.client_email)=lower(c.email)))))
      ORDER BY c.name) FROM public.clients c LEFT JOIN public.blade_providers p ON p.id=c.provider_id),'[]'::jsonb),
    'honored_total',(SELECT count(*) FROM public.bookings b WHERE public.blade_booking_honored(b)),
    'honored_clients',(SELECT count(DISTINCT COALESCE(b.client_id::text, lower(b.client_email))) FROM public.bookings b WHERE public.blade_booking_honored(b)),
    'unattributed_clients',(SELECT count(*) FROM public.clients WHERE provider_id IS NULL),
    'unattributed_bookings',(SELECT count(*) FROM public.bookings WHERE provider_id IS NULL));
END $function$;
