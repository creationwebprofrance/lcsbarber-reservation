
-- Add blacklist and unpaid columns to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS unpaid_amount numeric NOT NULL DEFAULT 0;

-- Create client_merges table for unmerge support
CREATE TABLE public.client_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_email text NOT NULL,
  target_email text NOT NULL,
  original_client_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client merges"
ON public.client_merges
FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins can view client merges"
ON public.client_merges
FOR SELECT
USING (public.is_admin());
