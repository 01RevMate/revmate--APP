BEGIN;

-- A short, catchy headline the seller writes to grab attention, shown
-- alongside the price on a "for sale" listing/feed card (e.g. "Widebody M4
-- — turn heads on every drive"). Optional — falls back to no headline shown.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS headline text;

COMMIT;
