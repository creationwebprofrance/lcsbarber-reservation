-- Historique des relances par email envoyées par un prestataire à ses clients.
-- Écriture réservée au serveur (fonction blade-relance) ; le prestataire lit uniquement ses propres relances.
CREATE TABLE IF NOT EXISTS public.blade_client_relances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_id uuid NOT NULL REFERENCES public.blade_providers(id),
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 subject text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blade_client_relances_provider_idx ON public.blade_client_relances(provider_id, client_id, sent_at DESC);
GRANT SELECT ON public.blade_client_relances TO authenticated;
GRANT ALL ON public.blade_client_relances TO service_role;
ALTER TABLE public.blade_client_relances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own relances" ON public.blade_client_relances;
CREATE POLICY "Owner reads own relances" ON public.blade_client_relances FOR SELECT TO authenticated USING (public.blade_owns_provider(provider_id));
