-- Why a car left the garage when it's marked as previously owned: sold,
-- scrapped, written off or something else. Null while the car is current
-- (and for cars moved to previously owned before this column existed).
ALTER TABLE public.garage_cars
  ADD COLUMN IF NOT EXISTS ownership_end_reason text
  CHECK (ownership_end_reason IN ('sold', 'scrapped', 'written_off', 'other'));
