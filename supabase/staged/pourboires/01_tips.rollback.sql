-- Retour arrière de 01_tips.sql.
-- Ne supprime aucune donnée :
--   - la colonne blade_providers.tip_url est RENOMMÉE tip_url_retire : les liens enregistrés
--     cessent d'être lus par les fonctions mais restent récupérables. La contrainte CHECK
--     blade_providers_tip_url_check suit la colonne renommée (Postgres la rattache à la colonne,
--     pas à son nom) : elle s'applique désormais à tip_url_retire, sous le même nom de contrainte.
--   - les trois fonctions sont retirées de l'API (EXECUTE révoqué pour authenticated) ; elles
--     restent définies (service_role garde EXECUTE, mais elles échoueraient : tip_url n'existe plus).
-- Effet côté site : l'écran Pourboires et le bouton « Laisser un pourboire » reçoivent une erreur
--   de droit ; src/blade/data.ts doit la traiter comme « pas de pourboire ».
-- Pour remettre en service : ALTER TABLE public.blade_providers RENAME COLUMN tip_url_retire TO tip_url;
--   puis GRANT EXECUTE des trois fonctions à authenticated (ne pas réappliquer 01_tips.sql :
--   la contrainte du même nom existe déjà).
-- Une suppression définitive (DROP COLUMN, irréversible) est une décision séparée de l'utilisateur.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.blade_my_tip_link() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_set_tip_link(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_my_tip_links() FROM authenticated;

ALTER TABLE public.blade_providers RENAME COLUMN tip_url TO tip_url_retire;

COMMIT;
