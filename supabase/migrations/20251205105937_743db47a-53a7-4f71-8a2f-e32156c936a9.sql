-- 1. Créer une table clients pour enregistrer les personnes qui réservent
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Politique: les admins peuvent tout voir
CREATE POLICY "Admins can manage clients"
ON public.clients
FOR ALL
USING (is_admin());

-- Politique: insertion publique pour permettre l'enregistrement lors de réservation
CREATE POLICY "Anyone can create clients"
ON public.clients
FOR INSERT
WITH CHECK (true);

-- Trigger pour updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Ajouter une politique SELECT sur la vue public_reviews pour tous
-- Note: Les vues héritent des politiques des tables sous-jacentes, 
-- mais cette vue expose uniquement des données publiques (sans email)
-- On va créer une politique sur la table reviews pour SELECT via la vue

-- Supprimer la vue existante et la recréer avec security_invoker = false
DROP VIEW IF EXISTS public.public_reviews;

CREATE VIEW public.public_reviews 
WITH (security_invoker = false)
AS
SELECT 
  id,
  client_name,
  rating,
  comment,
  booking_id,
  created_at,
  updated_at
FROM public.reviews;

-- Donner accès à la vue pour anon et authenticated
GRANT SELECT ON public.public_reviews TO anon, authenticated;