-- Trust and provenance for the reference info we populate on a car page:
-- every fault and the overview itself can cite where it came from.
ALTER TABLE public.cars ADD COLUMN source_url text;
ALTER TABLE public.car_faults ADD COLUMN source_url text;
