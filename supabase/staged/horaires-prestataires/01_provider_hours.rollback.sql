-- Retour arrière de 01_provider_hours.sql.
-- Ne supprime aucune donnée : les deux tables sont renommées (suffixe _retire) et les fonctions
-- d'écriture sont retirées de l'API (EXECUTE révoqué). blade-booking (version de cette branche)
-- détecte les tables absentes et renvoie « aucun créneau » pour les prestataires autres que
-- LCS Barber, comme avant la migration ; LCS Barber n'est pas touché.
-- Pour remettre en service : renommer dans l'autre sens et rendre EXECUTE à authenticated.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.blade_save_hours(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_add_date_override(date, boolean, time, time, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.blade_delete_date_override(uuid) FROM authenticated;

ALTER TABLE public.blade_provider_hours RENAME TO blade_provider_hours_retire;
ALTER TABLE public.blade_provider_date_overrides RENAME TO blade_provider_date_overrides_retire;

COMMIT;
