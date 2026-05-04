-- Add new plan types to enum
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'quarterly';

-- Add premium_since column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ;

-- Function to expire premium access
CREATE OR REPLACE FUNCTION public.expire_premium_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET plan = 'basic',
      premium_until = NULL,
      premium_since = NULL
  WHERE plan IN ('premium', 'monthly', 'quarterly')
    AND premium_until IS NOT NULL
    AND premium_until < now();
END;
$$;

-- Schedule daily expiration check via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-premium-daily') THEN
    PERFORM cron.schedule('expire-premium-daily', '0 3 * * *', $cron$SELECT public.expire_premium_users();$cron$);
  END IF;
END $$;