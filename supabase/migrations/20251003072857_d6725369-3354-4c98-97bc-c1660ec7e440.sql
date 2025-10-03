-- Table pour les avis clients
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les avis
CREATE POLICY "Anyone can view reviews" 
ON public.reviews 
FOR SELECT 
USING (true);

-- Tout le monde peut créer un avis
CREATE POLICY "Anyone can create reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (true);

-- Les admins peuvent gérer tous les avis
CREATE POLICY "Admins can manage all reviews" 
ON public.reviews 
FOR ALL 
USING (is_admin());

-- Trigger pour updated_at
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();