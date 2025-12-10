-- Drop the existing restrictive policy for review creation
DROP POLICY IF EXISTS "Verified clients can create reviews" ON public.reviews;

-- Create a simpler policy that allows anyone to create reviews
-- Reviews don't need authentication - they just need name and rating
CREATE POLICY "Anyone can create reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (true);

-- Keep the public_reviews view accessible
DROP POLICY IF EXISTS "Anyone can view public reviews" ON public.public_reviews;