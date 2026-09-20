-- A garage car can be marked as previously owned (sold) instead of only
-- either "currently in the garage" or "deleted" — keeps its likes, mods,
-- photos and post history intact instead of losing them on removal.
CREATE TYPE public.garage_car_ownership_status AS ENUM ('current', 'previous');

ALTER TABLE public.garage_cars
  ADD COLUMN ownership_status public.garage_car_ownership_status NOT NULL DEFAULT 'current';
