-- Business account opt-in: business tools stay hidden until a member switches
-- them on in Settings. Existing business owners are switched on automatically.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_account boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET business_account = true
WHERE user_id IN (SELECT owner_user_id FROM public.businesses WHERE owner_user_id IS NOT NULL);
