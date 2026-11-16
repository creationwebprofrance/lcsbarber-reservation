CREATE TABLE public.blade_subscriptions (
  provider_id uuid PRIMARY KEY REFERENCES public.blade_providers(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  status text NOT NULL DEFAULT 'none' CHECK (status IN ('none','trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  had_trial boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blade_subscriptions TO authenticated;
GRANT ALL ON public.blade_subscriptions TO service_role;

ALTER TABLE public.blade_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers read their own subscription"
ON public.blade_subscriptions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.blade_providers p
  WHERE p.id = blade_subscriptions.provider_id AND p.user_id = auth.uid()
));

CREATE TRIGGER update_blade_subscriptions_updated_at
BEFORE UPDATE ON public.blade_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.blade_my_subscription()
RETURNS public.blade_subscriptions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider uuid;
  v_row public.blade_subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_provider FROM public.blade_providers WHERE user_id = auth.uid() LIMIT 1;
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Aucun compte prestataire' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.blade_subscriptions WHERE provider_id = v_provider;
  IF NOT FOUND THEN
    v_row.provider_id := v_provider;
    v_row.plan := 'free';
    v_row.status := 'none';
    v_row.cancel_at_period_end := false;
    v_row.had_trial := false;
    v_row.updated_at := now();
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.blade_my_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blade_my_subscription() FROM anon;
GRANT EXECUTE ON FUNCTION public.blade_my_subscription() TO authenticated;