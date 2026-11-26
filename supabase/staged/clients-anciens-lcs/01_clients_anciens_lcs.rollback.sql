-- Retour arrière de 01_clients_anciens_lcs.sql (anciens clients LCS Barber).
-- NON APPLIQUÉ. À lancer seulement sur décision de l'utilisateur.
--
-- Ce que fait le fichier : supprime de public.clients UNIQUEMENT les lignes listées dans
--   public.blade_legacy_client_import (removed_at IS NULL), et seulement si la ligne :
--   - n'est référencée par aucune réservation (bookings.client_id, ou bookings.client_email
--     identique à la casse près), aucune prestation (prestations.client_id), aucune demande de
--     créneau (slot_requests.client_email), aucune carte de fidélité (blade_loyalty_cards.client_email)
--     ni aucune relance (blade_client_relances.client_id), et dont l'e-mail ne figure pas dans
--     une fusion (client_merges.merged_email ou target_email) ;
--   - n'a pas été modifiée depuis l'import (updated_at <= imported_at : ni liste noire, ni impayé,
--     ni nom ou téléphone corrigé par le prestataire).
--   Les lignes gardées restent dans clients et dans la table de suivi (removed_at NULL) ; le
--   nombre est affiché en NOTICE.
-- Ce qui reste : la table blade_legacy_client_import n'est pas supprimée (pas de DROP TABLE) ;
--   les lignes retirées y sont marquées removed_at = now(), ce qui permet de rejouer la migration.
--   Une suppression de la table reste une décision séparée de l'utilisateur.
--
-- Contrôle préalable (informatif) : nombre de lignes qui seraient retirées et gardées.
--   SELECT count(*) FILTER (WHERE c.id IS NOT NULL) AS presentes, count(*) AS tracees
--     FROM public.blade_legacy_client_import i LEFT JOIN public.clients c ON c.id = i.client_id
--    WHERE i.removed_at IS NULL;

BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

DO $rb$
DECLARE n_del int; n_kept int;
BEGIN
  IF to_regclass('public.blade_legacy_client_import') IS NULL THEN
    RAISE NOTICE 'Table blade_legacy_client_import absente : rien à retirer';
    RETURN;
  END IF;

  CREATE TEMP TABLE _blade_lci_del ON COMMIT DROP AS
  SELECT i.client_id
    FROM public.blade_legacy_client_import i
    JOIN public.clients c ON c.id = i.client_id AND c.provider_id = i.provider_id
   WHERE i.removed_at IS NULL
     AND c.updated_at <= i.imported_at
     AND NOT EXISTS (SELECT 1 FROM public.bookings b
                      WHERE b.client_id = c.id OR lower(trim(b.client_email)) = lower(trim(c.email)))
     AND NOT EXISTS (SELECT 1 FROM public.prestations p WHERE p.client_id = c.id)
     AND NOT EXISTS (SELECT 1 FROM public.slot_requests s WHERE lower(trim(s.client_email)) = lower(trim(c.email)))
     AND NOT EXISTS (SELECT 1 FROM public.blade_loyalty_cards l WHERE lower(trim(l.client_email)) = lower(trim(c.email)))
     AND NOT EXISTS (SELECT 1 FROM public.blade_client_relances r WHERE r.client_id = c.id)
     AND NOT EXISTS (SELECT 1 FROM public.client_merges x
                      WHERE lower(trim(x.merged_email)) = lower(trim(c.email))
                         OR lower(trim(x.target_email)) = lower(trim(c.email)));

  DELETE FROM public.clients c
   WHERE c.id IN (SELECT client_id FROM _blade_lci_del)
     AND c.id IN (SELECT client_id FROM public.blade_legacy_client_import WHERE removed_at IS NULL);
  GET DIAGNOSTICS n_del = ROW_COUNT;

  UPDATE public.blade_legacy_client_import SET removed_at = now()
   WHERE removed_at IS NULL AND client_id IN (SELECT client_id FROM _blade_lci_del);

  -- Lignes tracées dont le client a déjà disparu (supprimé à la main) : marquées aussi.
  UPDATE public.blade_legacy_client_import i SET removed_at = now()
   WHERE i.removed_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = i.client_id);

  SELECT count(*) INTO n_kept FROM public.blade_legacy_client_import WHERE removed_at IS NULL;
  RAISE NOTICE 'Anciens clients retirés : % ; gardés (référencés ou modifiés) : %', n_del, n_kept;
END $rb$;

COMMIT;
