-- APPLIQUÉ en production le 2026-11-25 (accord de l'utilisateur). Ne pas réappliquer.
-- Pourboires des prestataires BLADE, par un lien de paiement du prestataire.
-- NON APPLIQUÉ. À appliquer seulement après relecture de Cerbère et accord de l'utilisateur.
--
-- Pourquoi : comme pour les acomptes, le pourboire passe par un lien fourni par le prestataire
--   (Revolut, ou lien de paiement Stripe à montant libre). Aucune API Stripe, aucune commission,
--   rien n'est vérifié automatiquement. Fonction réservée aux plans Pro et Premium
--   (public.blade_effective_plan(id) <> 'free'). Elle ne dépend PAS de l'option opt_payment_links.
-- Ce que fait le fichier (uniquement des AJOUTS ; aucune fonction existante n'est modifiée) :
--   1. colonne blade_providers.tip_url (NULL ou lien au format exact accepté par le navigateur :
--      REVOLUT_LINK et STRIPE_LINK de src/blade/provider-admin-model.ts, traduits en regex POSIX
--      ancrées, identiques à celles des contraintes revolut_url / stripe_link_url existantes).
--   2. blade_my_tip_link() : le prestataire connecté lit son lien et s'il y a droit (plan).
--   3. blade_set_tip_link(p_url) : le prestataire actif enregistre ou vide son lien
--      (enregistrer : plan Pro ou Premium et format valide ; vider : toujours permis).
--   4. blade_my_tip_links() : le CLIENT connecté (auth.email()) reçoit, pour ses rendez-vous
--      confirmés ou terminés des 30 derniers jours (heure de Paris, aujourd'hui inclus), le lien
--      du prestataire s'il est actif, a un lien et un plan payant. 20 au maximum. Ni e-mail ni
--      téléphone : booking_id, appointment_date, provider_name, service_name, tip_url.
-- Droits vérifiés le 2026-11-25 (lecture seule) :
--   - blade_providers : RLS active, une seule politique (SELECT, authenticated,
--     user_id = auth.uid() OR is_superadmin()) ; aucune politique INSERT/UPDATE/DELETE, donc aucune
--     écriture directe ; anon ne lit aucune ligne. Les droits de table d'anon/authenticated
--     (défauts Supabase) couvrent la nouvelle colonne, mais la RLS la limite au propriétaire et au
--     superadmin (LCS Barber). Les clients ne la lisent que par blade_my_tip_links.
--   - blade_my_provider et blade_update_own_provider listent leurs colonnes une par une : ils
--     n'exposent ni n'écrivent tip_url (non modifiés). blade-booking lit aussi une liste fixe.
--   - Trigger blade_validate_provider (BEFORE INSERT OR UPDATE) : il ne lit pas tip_url et ne
--     casse pas ; il n'est pas modifié. La normalisation (trim, '' → NULL) et les messages en
--     français sont dans blade_set_tip_link, seul chemin d'écriture ; la contrainte CHECK protège
--     tout autre chemin (service_role, superadmin SQL). Une mise à jour du lien repasse par le
--     trigger (statut, nom, liens d'acompte) : ses messages sont déjà en français.
-- Données personnelles : aucune nouvelle (lien de paiement public par nature, destiné aux clients).
-- Ordre : appliquer avant de mettre en ligne l'écran qui appelle ces RPC (src/blade/data.ts).
--
-- Contrôle préalable : doit renvoyer 0 ligne.
--   SELECT 'deja present : colonne ' || column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'blade_providers' AND column_name IN ('tip_url', 'tip_url_retire')
--   UNION ALL
--   SELECT 'deja present : ' || f FROM unnest(ARRAY['blade_my_tip_link()', 'blade_set_tip_link(text)', 'blade_my_tip_links()']) f
--    WHERE to_regprocedure('public.' || f) IS NOT NULL
--   UNION ALL
--   SELECT 'deja present : contrainte blade_providers_tip_url_check' FROM pg_constraint
--    WHERE conrelid = 'public.blade_providers'::regclass AND conname = 'blade_providers_tip_url_check'
--   UNION ALL
--   SELECT 'fonction absente : ' || f FROM unnest(ARRAY['blade_effective_plan(uuid)', 'is_superadmin()']) f
--    WHERE to_regprocedure('public.' || f) IS NULL;
--   (Si tip_url_retire existe, un retour arrière a eu lieu : renommer la colonne en tip_url et
--   rendre EXECUTE à authenticated, au lieu de réappliquer ce fichier.)
--
-- Retour arrière : 01_tips.rollback.sql (renomme la colonne, ne supprime rien).

BEGIN;

ALTER TABLE public.blade_providers ADD COLUMN IF NOT EXISTS tip_url text
  CONSTRAINT blade_providers_tip_url_check CHECK (
    tip_url IS NULL
    OR tip_url ~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$'
    OR tip_url ~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$'
  );

CREATE OR REPLACE FUNCTION public.blade_my_tip_link()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT p.id, p.tip_url INTO r FROM public.blade_providers p WHERE p.user_id = auth.uid();
  IF r.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('tip_url', r.tip_url, 'allowed', public.blade_effective_plan(r.id) <> 'free');
END $f$;

CREATE OR REPLACE FUNCTION public.blade_set_tip_link(p_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE r record; v text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT p.id, p.status INTO r FROM public.blade_providers p WHERE p.user_id = auth.uid();
  END IF;
  IF r.id IS NULL OR r.status <> 'active' THEN RAISE EXCEPTION 'Compte prestataire non actif'; END IF;
  v := NULLIF(btrim(COALESCE(p_url, ''), E' \t\r\n'), '');
  IF v IS NOT NULL THEN
    IF public.blade_effective_plan(r.id) = 'free' THEN
      RAISE EXCEPTION 'Les pourboires sont inclus dans le plan Pro';
    END IF;
    IF length(v) > 200
       OR (v !~ '^https://(www\.)?revolut\.me/[A-Za-z0-9._-]{1,64}(/[A-Za-z0-9._-]{1,32})?/?$'
           AND v !~ '^https://buy\.stripe\.com/[A-Za-z0-9_]{1,128}$') THEN
      RAISE EXCEPTION 'Lien invalide : il doit commencer par https://revolut.me/ ou https://buy.stripe.com/';
    END IF;
  END IF;
  BEGIN
    UPDATE public.blade_providers SET tip_url = v WHERE id = r.id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Lien invalide : il doit commencer par https://revolut.me/ ou https://buy.stripe.com/';
  END;
  RETURN public.blade_my_tip_link();
END $f$;

CREATE OR REPLACE FUNCTION public.blade_my_tip_links()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  v_email text := lower(NULLIF(btrim(auth.email()), ''));
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x.item ORDER BY x.d DESC, x.t DESC NULLS LAST)
    FROM (
      SELECT b.appointment_date AS d, b.appointment_time AS t,
             jsonb_build_object(
               'booking_id', b.id,
               'appointment_date', b.appointment_date,
               'provider_name', p.display_name,
               'service_name', s.name,
               'tip_url', p.tip_url) AS item
      FROM public.bookings b
      JOIN public.blade_providers p ON p.id = b.provider_id
      LEFT JOIN public.services s ON s.id = b.service_id
      WHERE lower(b.client_email) = v_email
        AND b.status IN ('confirmed', 'completed')
        AND b.appointment_date BETWEEN v_today - 30 AND v_today
        -- Le jour même, seulement une fois l'heure du rendez-vous passée (heure de Paris).
        AND (b.appointment_date < v_today OR b.appointment_time <= (now() AT TIME ZONE 'Europe/Paris')::time)
        AND p.status = 'active'
        AND p.tip_url IS NOT NULL
        AND public.blade_effective_plan(p.id) <> 'free'
      ORDER BY b.appointment_date DESC, b.appointment_time DESC NULLS LAST
      LIMIT 20
    ) x
  ), '[]'::jsonb);
END $f$;

REVOKE ALL ON FUNCTION public.blade_my_tip_link() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blade_set_tip_link(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blade_my_tip_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blade_my_tip_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.blade_set_tip_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blade_my_tip_links() TO authenticated;

COMMIT;
