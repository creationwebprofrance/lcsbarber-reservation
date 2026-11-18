-- Superadmin : mêmes totaux que l'ancien admin LCS Barber (onglet Clients).
-- Rendez-vous = toutes les réservations. Clients = une fiche par rendez-vous, sauf adresses
-- Louvres / 4 square de Banyuls et e-mails fusionnés (regroupés), + comptes sans réservation.
CREATE OR REPLACE FUNCTION public.blade_lcs_resolve_email(p_email text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE cur text := p_email; nxt text; i int := 0;
BEGIN
  LOOP
    SELECT lower(trim(target_email)) INTO nxt FROM public.client_merges
      WHERE lower(trim(merged_email)) = cur ORDER BY created_at DESC LIMIT 1;
    EXIT WHEN nxt IS NULL OR nxt = cur OR i >= 20;
    cur := nxt; i := i + 1;
  END LOOP;
  RETURN cur;
END $$;

CREATE OR REPLACE FUNCTION public.blade_lcs_totals()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Réservé au superadmin'; END IF;
  WITH merged AS (
    SELECT lower(trim(merged_email)) e FROM public.client_merges
    UNION SELECT lower(trim(target_email)) FROM public.client_merges),
  admins AS (
    SELECT lower(u.email) e FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
    WHERE r.role::text = 'superadmin'),
  b AS (SELECT id, lower(trim(coalesce(client_email,''))) e, lower(coalesce(client_address,'')) a FROM public.bookings),
  keys AS (
    SELECT CASE WHEN b.e NOT IN (SELECT e FROM admins)
                 AND (b.e IN (SELECT e FROM merged) OR b.a LIKE '%louvres%' OR b.a LIKE '%4 square de banyuls%')
           THEN public.blade_lcs_resolve_email(b.e) ELSE 'single-' || b.id END k FROM b
    UNION
    SELECT lower(trim(p.email)) FROM public.profiles p
    WHERE p.email IS NOT NULL AND lower(trim(p.email)) NOT IN (SELECT e FROM b))
  SELECT jsonb_build_object(
    'clients', (SELECT count(*) FROM keys),
    'bookings', (SELECT count(*) FROM public.bookings),
    'revenue', (SELECT coalesce(sum(total_price),0) FROM public.bookings),
    'pending', (SELECT count(*) FROM public.bookings WHERE status = 'pending'))
  INTO out;
  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.blade_lcs_resolve_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blade_lcs_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_lcs_totals() TO authenticated;
