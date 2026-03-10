
-- Table for multiple images per artist
CREATE TABLE public.artist_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artist images" ON public.artist_images
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage artist images" ON public.artist_images
  FOR ALL USING (public.is_admin());

-- Migrate existing photo_url data to artist_images
INSERT INTO public.artist_images (artist_id, image_url, display_order)
SELECT id, photo_url, 0 FROM public.artists WHERE photo_url IS NOT NULL;
