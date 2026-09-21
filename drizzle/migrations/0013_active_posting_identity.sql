-- Lets a user pick a single "posting identity" (their own profile, or one of
-- their garage cars) that persists across sessions/devices, used as the
-- default for new posts and to disambiguate the My Car / Same Brand feed
-- scopes when someone owns more than one car.
ALTER TABLE public.profiles
  ADD COLUMN active_garage_car_id uuid REFERENCES public.garage_cars(id) ON DELETE SET NULL;
