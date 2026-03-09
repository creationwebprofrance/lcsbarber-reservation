-- Create artists table
CREATE TABLE public.artists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Admins can manage artists" ON public.artists FOR ALL USING (is_admin());

-- Create storage bucket for artist photos
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-photos', 'artist-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view artist photos" ON storage.objects FOR SELECT USING (bucket_id = 'artist-photos');
CREATE POLICY "Admins can upload artist photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'artist-photos' AND (SELECT is_admin()));
CREATE POLICY "Admins can update artist photos" ON storage.objects FOR UPDATE USING (bucket_id = 'artist-photos' AND (SELECT is_admin()));
CREATE POLICY "Admins can delete artist photos" ON storage.objects FOR DELETE USING (bucket_id = 'artist-photos' AND (SELECT is_admin()));

-- Seed existing artists
INSERT INTO public.artists (name, description, display_order) VALUES
  ('Jixels', 'Gestion backstage complète — coupe et préparation avant le show pour un rendu scénique impeccable. Tenue longue durée adaptée aux conditions live.', 1),
  ('BRG Hollywood', 'Styling sur mesure avant tournage — adaptation aux projecteurs et caméras. Coupe pensée pour valoriser l''image à l''écran.', 2),
  ('Dcamp', 'Prestation événementielle — coupe et finitions dans un contexte high-energy. Gestion du timing serré avec un résultat toujours propre.', 3),
  ('Le Juh', 'Collaboration backstage lors d''événements live — coupe express et précise. Adaptation aux contraintes de planning et d''espace.', 4),
  ('Lewismelo', 'Prestation coiffure en coulisses avant passage sur scène. Soin du détail pour un look qui tient du début à la fin du set.', 5),
  ('Aknose', 'Mise en forme et styling avant showcase — gestion des finitions de dernière minute. Expertise en coupe adaptée aux performances live.', 6),
  ('Cocotteland', 'Coiffure backstage festival — ambiance décontractée mais résultat pro. Adaptation au style unique de l''artiste pour chaque événement.', 7),
  ('Dy Nice', 'Prestation coiffure pré-événement — dégradé et finitions soignées. Expérience backstage avec gestion des imprévus et du timing.', 8),
  ('Tency', 'Styling complet avant scène — coupe, contours et mise en forme. Résultat pensé pour durer sous les projecteurs.', 9),
  ('Young Chang', 'Collaboration événementielle — coupe signature et finitions impeccables. Adaptation au style de l''artiste et aux conditions backstage.', 10);