-- STEP 4 — Bring existing profiles up to date with the new features
-- Run after step 3. Safe to run more than once: it only fills in blanks and
-- never overwrites anything someone has already set.

BEGIN;

-- For You feed: use each person's current garage makes as their favourite
-- makes, so their feed is personalised straight away. Only fills profiles
-- that haven't picked any yet. (They'll still see the one-time "What will
-- you use RevMate for?" setup, where they can change them.)
UPDATE public.profiles p
SET favourite_makes = sub.makes[1:20]
FROM (
  SELECT user_id, array_agg(DISTINCT btrim(make) ORDER BY btrim(make)) AS makes
  FROM public.garage_cars
  WHERE ownership_status = 'current' AND btrim(make) <> ''
  GROUP BY user_id
) sub
WHERE sub.user_id = p.user_id
  AND cardinality(p.favourite_makes) = 0;

-- Rank-up alerts: record every current car's leaderboard position now, so
-- the first "your car moved up" alert can fire as soon as it climbs.
SELECT set_config('revmate.counter_update', 'on', true);
UPDATE public.garage_cars g
SET last_rank = ranked.rank
FROM (
  SELECT id,
    row_number() OVER (ORDER BY likes_count - dislikes_count DESC, created_at ASC, id ASC) AS rank
  FROM public.garage_cars
  WHERE ownership_status = 'current'
) ranked
WHERE ranked.id = g.id
  AND g.last_rank IS NULL;
SELECT set_config('revmate.counter_update', 'off', true);

-- Notification settings: give everyone the default (all on, no quiet hours)
-- so the Settings page has a row to update.
INSERT INTO public.notification_settings (user_id)
SELECT user_id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
