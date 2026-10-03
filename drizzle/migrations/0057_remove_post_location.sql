-- Removes the location that could be attached to posts. It only powered the
-- old "Near you" page, which has been removed, and anyone could read a
-- post's rough coordinates (~1 km) through the API even though the app never
-- showed them. Location rules (docs/LOCATION_PRIVACY.md): members never see
-- each other's coordinates. Meet locations are untouched — organisers
-- choose to publish those. Safe to re-run.

BEGIN;

DROP FUNCTION IF EXISTS public.nearby_posts(double precision, double precision, double precision, integer);
DROP TRIGGER IF EXISTS round_post_location ON public.posts;
DROP FUNCTION IF EXISTS private.round_post_location();
DROP POLICY IF EXISTS posts_location_adults_only ON public.posts;
DROP INDEX IF EXISTS public.posts_location_idx;
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

COMMIT;
