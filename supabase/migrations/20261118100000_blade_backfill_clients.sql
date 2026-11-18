-- Crée une fiche client pour chaque personne ayant réservé sans fiche,
-- à partir de son rendez-vous le plus récent, puis rattache ses rendez-vous.
WITH missing AS (
  SELECT DISTINCT ON (lower(trim(b.client_email)))
    lower(trim(b.client_email)) AS email, trim(b.client_name) AS name, NULLIF(trim(b.client_phone), '') AS phone,
    NULLIF(trim(b.client_address), '') AS address, b.provider_id
  FROM public.bookings b
  WHERE NULLIF(trim(b.client_email), '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = b.client_id OR lower(c.email) = lower(trim(b.client_email)))
  ORDER BY lower(trim(b.client_email)), b.appointment_date DESC, b.created_at DESC
)
INSERT INTO public.clients (email, name, phone, address, provider_id)
SELECT email, COALESCE(NULLIF(name, ''), split_part(email, '@', 1)), phone, address, provider_id FROM missing
ON CONFLICT (email) DO NOTHING;

UPDATE public.bookings b SET client_id = c.id
FROM public.clients c
WHERE b.client_id IS NULL AND lower(c.email) = lower(trim(b.client_email));
