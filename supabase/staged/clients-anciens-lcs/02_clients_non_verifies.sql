-- clients-anciens-lcs, étape 2 : 6 anciens contacts de LCS Barber dont l'adresse n'a jamais été vérifiée
-- (4 réservations non finalisées, 2 avis), ajoutés à la demande explicite de l'utilisateur
-- le 2026-11-26 (« ajoute tous les anciens clients »), malgré l'avis RGPD de Cerbère.
-- Additif : INSERT seulement, tracé dans blade_legacy_client_import (créée par l'étape 1).
-- Garde : comptes exacts et empreinte md5 des adresses (aucune adresse dans ce fichier).
-- Retour arrière : 01_clients_anciens_lcs.rollback.sql (retire toutes les lignes tracées non utilisées).
-- Ne pas relancer ces contacts par e-mail sans lien d'opposition ni consentement.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $chk$
BEGIN
  IF to_regclass('public.blade_legacy_client_import') IS NULL THEN
    RAISE EXCEPTION 'Étape 1 (01_clients_anciens_lcs.sql) non appliquée';
  END IF;
END $chk$;

LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

DO $imp$
DECLARE
  pid uuid;
  n_pb int; n_rv int; n_br int; n_total int; n_ins int; fp text;
BEGIN
  SELECT id INTO pid FROM public.blade_providers
   WHERE user_id = 'da0b2f45-1ee1-441e-a06d-3bd046615ca8'::uuid AND status = 'active';
  IF pid IS NULL THEN RAISE EXCEPTION 'Prestataire LCS Barber introuvable ou inactif'; END IF;

  DROP TABLE IF EXISTS pg_temp._blade_lci_cand2;
  CREATE TEMP TABLE _blade_lci_cand2 ON COMMIT DROP AS
  WITH src AS (
    SELECT regexp_replace(lower(client_email), '\s', '', 'g') AS e, 'pending_bookings'::text AS s, 2 AS prio,
           nullif(trim(client_name), '') AS nm, nullif(trim(client_phone), '') AS ph, nullif(trim(client_address), '') AS ad, created_at AS ts
      FROM public.pending_bookings WHERE created_at < '2026-11-12'
    UNION ALL
    SELECT regexp_replace(lower(client_email), '\s', '', 'g'), 'reviews', 3,
           nullif(trim(client_name), ''), NULL, NULL, created_at
      FROM public.reviews WHERE created_at < '2026-11-12'
    UNION ALL
    SELECT regexp_replace(lower(client_email), '\s', '', 'g'), 'booking_requests', 4,
           nullif(trim(client_name), ''), nullif(trim(client_phone), ''), NULL, created_at
      FROM public.booking_requests WHERE created_at < '2026-11-12'
  ), m AS (
    SELECT * FROM src
     WHERE e ~ '^[^@]+@[^@]+\.[^@]+$'
       AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE lower(trim(c.email)) = src.e)
       AND NOT EXISTS (SELECT 1 FROM public.client_merges x WHERE lower(trim(x.merged_email)) = src.e)
  )
  SELECT e,
         (array_agg(s ORDER BY prio))[1] AS source,
         array_agg(DISTINCT s) AS sources,
         COALESCE((array_agg(nm ORDER BY ts DESC) FILTER (WHERE nm IS NOT NULL))[1], split_part(e, '@', 1)) AS name,
         (array_agg(ph ORDER BY ts DESC) FILTER (WHERE ph IS NOT NULL))[1] AS phone,
         (array_agg(ad ORDER BY ts DESC) FILTER (WHERE ad IS NOT NULL))[1] AS address
    FROM m GROUP BY e;

  SELECT count(*) FILTER (WHERE source = 'pending_bookings'), count(*) FILTER (WHERE source = 'reviews'),
         count(*) FILTER (WHERE source = 'booking_requests'), count(*), md5(string_agg(e, ',' ORDER BY e))
    INTO n_pb, n_rv, n_br, n_total, fp FROM _blade_lci_cand2;

  IF n_total = 0 THEN
    RAISE NOTICE 'Aucun contact à ajouter (étape 2 déjà appliquée)';
    RETURN;
  END IF;
  IF (n_pb, n_rv, n_br) <> (4, 2, 0) OR fp IS DISTINCT FROM 'be379ecf2209436e2554bbfb907814d4' THEN
    RAISE EXCEPTION 'Garde : % réservations non finalisées, % avis, % demandes (attendu 4, 2, 0), empreinte % (attendue be379ecf2209436e2554bbfb907814d4). Rien n''est appliqué.',
      n_pb, n_rv, n_br, fp;
  END IF;

  WITH ins AS (
    INSERT INTO public.clients (email, name, phone, address, provider_id)
    SELECT e, name, phone, address, pid FROM _blade_lci_cand2
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email
  ), trace AS (
    INSERT INTO public.blade_legacy_client_import (client_id, provider_id, source, sources)
    SELECT ins.id, pid, c.source, c.sources FROM ins JOIN _blade_lci_cand2 c ON c.e = ins.email
    RETURNING client_id
  )
  SELECT count(*) INTO n_ins FROM trace;

  IF n_ins <> n_total THEN
    RAISE EXCEPTION 'Garde : % contact(s) inséré(s) sur % attendu(s). Rien n''est appliqué.', n_ins, n_total;
  END IF;
  RAISE NOTICE 'Contacts non vérifiés ajoutés : %', n_ins;
END $imp$;

COMMIT;
