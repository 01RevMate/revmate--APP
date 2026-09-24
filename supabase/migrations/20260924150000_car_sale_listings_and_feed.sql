BEGIN;

-- A new post category so a garage car's sale listing can be pushed to the
-- feed as its own distinct card type, alongside discussion/showcase/etc.
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'for_sale';

-- AutoTrader-style listing details: a confirmed mileage snapshot at sale
-- time (may differ from the garage car's current mileage) and the listing's
-- own photo set (separate from the garage car's photo gallery, so editing
-- one doesn't silently change the other).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS mileage integer,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[];

-- Selling a car is now driven from the garage, and a garage car isn't
-- required to be linked to the generic catalog (car_id is optional there
-- too) — so a listing must be able to exist without a catalog car_id.
ALTER TABLE public.listings ALTER COLUMN car_id DROP NOT NULL;

-- Optional link from a feed post to the listing it was pushed from, so the
-- feed can render a distinct "for sale" card (price + photos) instead of a
-- normal text post.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS posts_listing_id_idx ON public.posts(listing_id);

COMMIT;
