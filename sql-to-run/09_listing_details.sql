-- STEP 9 — Full vehicle details on car listings (spec sheet + Buy & Sell
-- filters)
-- Copy of drizzle/migrations/0043_listing_details.sql
-- Run the whole file once, after step 8.

-- Full vehicle details on car listings, for a proper spec sheet on each
-- advert and Buy & Sell filters (make, model, year, mileage, fuel, gearbox,
-- body, engine size, owners, seller type, ULEZ…). Run after
-- 0042_announcements.sql. Everything is optional and additive: existing
-- listings keep working, and make/model/year are filled in from the linked
-- garage car where possible.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS make text CHECK (make IS NULL OR char_length(make) <= 60),
  ADD COLUMN IF NOT EXISTS model text CHECK (model IS NULL OR char_length(model) <= 80),
  ADD COLUMN IF NOT EXISTS year int CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  ADD COLUMN IF NOT EXISTS fuel_type text CHECK (fuel_type IS NULL OR fuel_type IN
    ('petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'lpg', 'other')),
  ADD COLUMN IF NOT EXISTS transmission text CHECK (transmission IS NULL OR transmission IN
    ('manual', 'automatic', 'cvt', 'dct', 'other')),
  ADD COLUMN IF NOT EXISTS body_type text CHECK (body_type IS NULL OR body_type IN
    ('hatchback', 'saloon', 'estate', 'coupe', 'convertible', 'suv', 'mpv', 'pickup', 'van', 'other')),
  ADD COLUMN IF NOT EXISTS engine_size_cc int CHECK (engine_size_cc IS NULL OR engine_size_cc BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS power_bhp int CHECK (power_bhp IS NULL OR power_bhp BETWEEN 0 AND 3000),
  ADD COLUMN IF NOT EXISTS colour text CHECK (colour IS NULL OR char_length(colour) <= 30),
  ADD COLUMN IF NOT EXISTS doors smallint CHECK (doors IS NULL OR doors BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS seats smallint CHECK (seats IS NULL OR seats BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS previous_owners smallint CHECK (previous_owners IS NULL OR previous_owners BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS mot_expiry date,
  ADD COLUMN IF NOT EXISTS service_history text CHECK (service_history IS NULL OR service_history IN
    ('full_dealer', 'full', 'partial', 'none')),
  ADD COLUMN IF NOT EXISTS seller_type text NOT NULL DEFAULT 'private' CHECK (seller_type IN ('private', 'trade')),
  ADD COLUMN IF NOT EXISTS ulez_compliant boolean,
  ADD COLUMN IF NOT EXISTS v5c_present boolean,
  ADD COLUMN IF NOT EXISTS modified boolean;

CREATE INDEX IF NOT EXISTS listings_active_make_idx ON public.listings (status, make, model);

-- New listings pick up make/model/year from the linked car if the seller
-- didn't fill them in.
CREATE OR REPLACE FUNCTION private.fill_listing_vehicle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gc record;
BEGIN
  IF NEW.garage_car_id IS NOT NULL AND (NEW.make IS NULL OR NEW.model IS NULL OR NEW.year IS NULL) THEN
    SELECT make, model, year INTO gc FROM public.garage_cars WHERE id = NEW.garage_car_id;
    IF FOUND THEN
      NEW.make := coalesce(NEW.make, gc.make);
      NEW.model := coalesce(NEW.model, gc.model);
      NEW.year := coalesce(NEW.year, gc.year);
    END IF;
  END IF;
  IF NEW.car_id IS NOT NULL AND (NEW.make IS NULL OR NEW.model IS NULL) THEN
    SELECT make, model INTO gc FROM public.cars WHERE id = NEW.car_id;
    IF FOUND THEN
      NEW.make := coalesce(NEW.make, gc.make);
      NEW.model := coalesce(NEW.model, gc.model);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.fill_listing_vehicle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fill_listing_vehicle ON public.listings;
CREATE TRIGGER fill_listing_vehicle BEFORE INSERT OR UPDATE OF garage_car_id, car_id ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.fill_listing_vehicle();

-- Fill in existing listings. Counter guards on listings (0035) allow this
-- flagged system update.
SELECT set_config('revmate.counter_update', 'on', true);
UPDATE public.listings l SET
  make = coalesce(l.make, gc.make),
  model = coalesce(l.model, gc.model),
  year = coalesce(l.year, gc.year),
  fuel_type = coalesce(l.fuel_type, CASE WHEN gc.fuel_type::text IN
    ('petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'other') THEN gc.fuel_type::text END),
  transmission = coalesce(l.transmission, gc.transmission::text),
  colour = coalesce(l.colour, left(gc.color, 30)),
  power_bhp = coalesce(l.power_bhp, CASE WHEN gc.horsepower BETWEEN 0 AND 3000 THEN gc.horsepower END)
FROM public.garage_cars gc
WHERE gc.id = l.garage_car_id;
UPDATE public.listings l SET make = coalesce(l.make, c.make), model = coalesce(l.model, c.model)
FROM public.cars c WHERE c.id = l.car_id AND (l.make IS NULL OR l.model IS NULL);

COMMIT;
