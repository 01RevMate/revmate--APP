-- Removes the location that could be attached to posts. It only powered the
-- old "Near you" page, which has been removed, and anyone could read a
-- post's rough coordinates (~1 km) through the API even though the app never
-- showed them. Location rules (docs/LOCATION_PRIVACY.md): members never see
-- each other's coordinates. Meet locations are untouched — organisers
-- choose to publish those.
--
-- Non-breaking on purpose: the columns stay (always empty) so an older copy
-- of the app that still sends or reads them keeps working. Safe to re-run.

BEGIN;

-- Any location sent with a post is now thrown away instead of rounded.
CREATE OR REPLACE FUNCTION private.round_post_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.latitude := NULL;
  NEW.longitude := NULL;
  RETURN NEW;
END;
$$;

-- Wipe the locations already stored.
UPDATE public.posts
SET latitude = NULL, longitude = NULL
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

COMMIT;
