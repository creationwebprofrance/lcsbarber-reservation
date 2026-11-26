-- Anciens clients LCS Barber absents de la page pro Clients de BLADE.
-- NON APPLIQUÉ. À appliquer seulement après relecture de Cerbère et accord de l'utilisateur.
-- Version 2 (2026-11-26) : corrections de Cerbère (comptes confirmés seulement, u.email,
--   empreinte md5, lock_timeout) et exclusion des adresses fusionnées (client_merges).
--
-- Pourquoi : la page pro Clients (src/blade/provider.tsx, ProviderClients) liste public.clients.
--   Des clients de l'ancien site LCSBARBER y manquent : ils ont un compte client confirmé
--   (auth.users + public.profiles, rôle 'client') mais n'ont jamais eu de ligne dans clients.
-- Ce que fait le fichier (uniquement des AJOUTS ; aucune ligne existante n'est modifiée ni supprimée) :
--   1. table public.blade_legacy_client_import (traçabilité et retour arrière) : id du client
--      inséré, prestataire, source principale, toutes les sources, date d'import, date de retrait.
--      Aucune donnée personnelle (ni e-mail, ni nom, ni téléphone). RLS activée, lecture réservée
--      au superadmin, politique RESTRICTIVE « Blade scoped » (blade_owns_provider) ; aucune écriture
--      possible par anon ou authenticated.
--   2. INSERT dans public.clients, provider_id = LCS Barber, de chaque compte client :
--      - créé avant le lancement de BLADE (2026-11-12) et confirmé (email_confirmed_at) ;
--      - sans rôle admin/superadmin dans user_roles et sans espace prestataire BLADE ;
--      - adresse = auth.users.email (adresse confirmée ; profiles.email est modifiable par
--        l'utilisateur, donc non utilisée), en minuscules et sans espaces ;
--      - absent de clients (comparaison lower(trim(email))) ;
--      - absent de client_merges.merged_email : une adresse que le prestataire a fusionnée dans
--        un autre client n'est pas recréée (sinon la fusion serait défaite par un doublon).
--      name : full_name du profil, sinon la partie locale de l'e-mail. phone et address : NULL
--      (les comptes n'en ont pas). Les autres colonnes gardent leurs valeurs par défaut.
--      Sources NON importées (adresses jamais vérifiées, risque de tiers destinataires de
--      blade-relance) : pending_bookings, reviews, booking_requests. Pour les réactiver sur décision
--      explicite de l'utilisateur, voir le bloc commenté « SOURCES DÉSACTIVÉES » plus bas ; il faut
--      alors aussi changer la garde (comptes et empreinte) et refaire le test annulé.
-- Garde : la transaction est annulée si les candidats ne sont pas exactement 25 comptes
--   (0 réservation non finalisée, 0 avis, 0 demande) d'empreinte
--   md5(string_agg(e, ',' ORDER BY e)) = '5d8f1a5da338deb28540cfe325db74ab' (état du 2026-11-26),
--   sauf s'il n'y a plus aucun candidat (import déjà appliqué : idempotent, NOT EXISTS sur
--   lower(trim(email)) et ON CONFLICT (email) DO NOTHING). Si la garde se déclenche, relancer Dédale.
--   (26 comptes avant l'exclusion de client_merges : empreinte '90de33abcdb36cc1230f65c01d61f75d'.)
-- Verrou : lock_timeout 5 s puis LOCK TABLE clients IN SHARE ROW EXCLUSIVE MODE le temps de la
--   transaction, pour qu'une réservation simultanée (blade-booking) ne crée pas le même client.
-- Triggers de clients : blade_default_provider_clients (BEFORE INSERT) ne fait rien puisque
--   provider_id est fourni ; update_clients_updated_at ne joue qu'à l'UPDATE.
-- Risques : ces clients deviennent destinataires possibles de blade-relance, qui n'a pas encore de
--   lien d'opposition (voir le message de Cerbère du 2026-11-26) ; clients.email reste UNIQUE global.
--   Retour arrière : 01_clients_anciens_lcs.rollback.sql.
--
-- Contrôle préalable : doit renvoyer 0 ligne (une ligne = l'état a changé, ne pas appliquer).
--   WITH c AS (
--     SELECT DISTINCT regexp_replace(lower(u.email), '\s', '', 'g') e
--       FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
--      WHERE p.role::text = 'client' AND u.created_at < '2026-11-12' AND u.email_confirmed_at IS NOT NULL
--        AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text IN ('admin','superadmin'))
--        AND NOT EXISTS (SELECT 1 FROM public.blade_providers b WHERE b.user_id = u.id)
--   ), m AS (
--     SELECT e FROM c WHERE e ~ '^[^@]+@[^@]+\.[^@]+$'
--        AND NOT EXISTS (SELECT 1 FROM public.clients x WHERE lower(trim(x.email)) = c.e)
--        AND NOT EXISTS (SELECT 1 FROM public.client_merges x WHERE lower(trim(x.merged_email)) = c.e)
--   )
--   SELECT 'etat change' AS alerte, count(*) AS n, to_regclass('public.blade_legacy_client_import') AS table_import FROM m
--   HAVING count(*) <> 25 OR md5(string_agg(e, ',' ORDER BY e)) IS DISTINCT FROM '5d8f1a5da338deb28540cfe325db74ab'
--       OR to_regclass('public.blade_legacy_client_import') IS NOT NULL;

BEGIN;
SET LOCAL lock_timeout = '5s';  -- aussi pour le CREATE TABLE (clé étrangère vers blade_providers)

CREATE TABLE IF NOT EXISTS public.blade_legacy_client_import (
  client_id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES public.blade_providers(id),
  source text NOT NULL CHECK (source IN ('auth_profile', 'pending_bookings', 'reviews', 'booking_requests')),
  sources text[] NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
COMMENT ON TABLE public.blade_legacy_client_import IS
  'Clients LCSBARBER ajoutés à public.clients par supabase/staged/clients-anciens-lcs (retour arrière : removed_at).';

ALTER TABLE public.blade_legacy_client_import ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blade_legacy_client_import FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blade_legacy_client_import TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blade_legacy_client_import TO service_role;

DO $pol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blade_legacy_client_import'
                 AND policyname = 'Superadmin reads legacy client import') THEN
    CREATE POLICY "Superadmin reads legacy client import" ON public.blade_legacy_client_import
      FOR SELECT TO authenticated USING (public.is_superadmin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blade_legacy_client_import'
                 AND policyname = 'Blade scoped legacy client import') THEN
    CREATE POLICY "Blade scoped legacy client import" ON public.blade_legacy_client_import
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (public.blade_owns_provider(provider_id)) WITH CHECK (public.blade_owns_provider(provider_id));
  END IF;
END $pol$;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

DO $imp$
DECLARE
  pid uuid;
  n_auth int; n_pb int; n_rv int; n_br int; n_total int; n_ins int; fp text;
BEGIN
  SELECT id INTO pid FROM public.blade_providers
   WHERE user_id = 'da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND status = 'active';
  IF pid IS NULL THEN RAISE EXCEPTION 'Prestataire LCS Barber introuvable ou inactif'; END IF;

  CREATE TEMP TABLE _blade_lci_cand ON COMMIT DROP AS
  WITH src AS (
    SELECT regexp_replace(lower(u.email), '\s', '', 'g') AS e, 'auth_profile'::text AS s, 1 AS prio,
           nullif(trim(p.full_name), '') AS nm, NULL::text AS ph, NULL::text AS ad, u.created_at AS ts
      FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
     WHERE p.role::text = 'client' AND u.created_at < '2026-11-12' AND u.email_confirmed_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role::text IN ('admin', 'superadmin'))
       AND NOT EXISTS (SELECT 1 FROM public.blade_providers b WHERE b.user_id = u.id)
    -- SOURCES DÉSACTIVÉES (adresses jamais vérifiées) : à réactiver seulement sur décision explicite
    -- de l'utilisateur, en changeant aussi la garde (comptes et empreinte) puis en refaisant le test annulé.
    -- UNION ALL
    -- SELECT regexp_replace(lower(client_email), '\s', '', 'g'), 'pending_bookings', 2,
    --        nullif(trim(client_name), ''), nullif(trim(client_phone), ''), nullif(trim(client_address), ''), created_at
    --   FROM public.pending_bookings WHERE created_at < '2026-11-12'
    -- UNION ALL
    -- SELECT regexp_replace(lower(client_email), '\s', '', 'g'), 'reviews', 3,
    --        nullif(trim(client_name), ''), NULL, NULL, created_at
    --   FROM public.reviews WHERE created_at < '2026-11-12'
    -- UNION ALL
    -- SELECT regexp_replace(lower(client_email), '\s', '', 'g'), 'booking_requests', 4,
    --        nullif(trim(client_name), ''), nullif(trim(client_phone), ''), NULL, created_at
    --   FROM public.booking_requests WHERE created_at < '2026-11-12'
  ), m AS (
    SELECT * FROM src
     WHERE e ~ '^[^@]+@[^@]+\.[^@]+$'
       AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE lower(trim(c.email)) = src.e)
       AND NOT EXISTS (SELECT 1 FROM public.client_merges x WHERE lower(trim(x.merged_email)) = src.e)
  )
  SELECT e,
         (array_agg(s ORDER BY prio))[1] AS source,
         array_agg(DISTINCT s) AS sources,
         COALESCE((array_agg(nm ORDER BY prio = 1 DESC, ts DESC) FILTER (WHERE nm IS NOT NULL))[1], split_part(e, '@', 1)) AS name,
         (array_agg(ph ORDER BY ts DESC) FILTER (WHERE ph IS NOT NULL))[1] AS phone,
         (array_agg(ad ORDER BY ts DESC) FILTER (WHERE ad IS NOT NULL))[1] AS address
    FROM m GROUP BY e;

  SELECT count(*) FILTER (WHERE source = 'auth_profile'), count(*) FILTER (WHERE source = 'pending_bookings'),
         count(*) FILTER (WHERE source = 'reviews'), count(*) FILTER (WHERE source = 'booking_requests'), count(*),
         md5(string_agg(e, ',' ORDER BY e))
    INTO n_auth, n_pb, n_rv, n_br, n_total, fp FROM _blade_lci_cand;

  IF n_total = 0 THEN
    RAISE NOTICE 'Aucun ancien client à ajouter (import déjà appliqué : % ligne(s) tracée(s))',
      (SELECT count(*) FROM public.blade_legacy_client_import WHERE removed_at IS NULL);
    RETURN;
  END IF;
  IF (n_auth, n_pb, n_rv, n_br) <> (25, 0, 0, 0) OR fp IS DISTINCT FROM '5d8f1a5da338deb28540cfe325db74ab' THEN
    RAISE EXCEPTION 'Garde : % comptes, % réservations non finalisées, % avis, % demandes à ajouter (attendu 25, 0, 0, 0), empreinte % (attendue 5d8f1a5da338deb28540cfe325db74ab). Rien n''est appliqué.',
      n_auth, n_pb, n_rv, n_br, fp;
  END IF;

  WITH ins AS (
    INSERT INTO public.clients (email, name, phone, address, provider_id)
    SELECT e, name, phone, address, pid FROM _blade_lci_cand
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email
  ), trace AS (
    INSERT INTO public.blade_legacy_client_import (client_id, provider_id, source, sources)
    SELECT ins.id, pid, c.source, c.sources FROM ins JOIN _blade_lci_cand c ON c.e = ins.email
    RETURNING client_id
  )
  SELECT count(*) INTO n_ins FROM trace;

  IF n_ins <> n_total THEN
    RAISE EXCEPTION 'Garde : % client(s) inséré(s) sur % attendu(s). Rien n''est appliqué.', n_ins, n_total;
  END IF;
  RAISE NOTICE 'Anciens clients ajoutés : % (comptes %)', n_ins, n_auth;
END $imp$;

COMMIT;
