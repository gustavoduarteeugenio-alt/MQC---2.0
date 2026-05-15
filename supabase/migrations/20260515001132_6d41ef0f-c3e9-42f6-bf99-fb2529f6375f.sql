
-- Add trial and onboarding tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone;

-- Backfill existing users
UPDATE public.profiles SET trial_started_at = created_at WHERE trial_started_at IS NULL;

-- Update signup trigger to set trial_started_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, plan, origem, trial_started_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'basic',
    NEW.raw_user_meta_data->>'origem',
    now()
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;
