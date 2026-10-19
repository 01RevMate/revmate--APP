-- Step 25: campaigns (TikTok landing-page counts, sign-up sources, Pixel and Android settings).
-- Copy of drizzle/migrations/0065_campaigns.sql. Run after step 24. Safe to re-run.

-- Campaigns: see which TikTok posts and ads bring people in, without
-- tracking anyone.
--   * campaign_visits: a daily count per campaign and source. No IDs, IPs
--     or device data.
--   * signup_sources: the campaign someone arrived from when they signed up,
--     passed in with the sign-up form (raw_user_meta_data.attribution).
--     Admins see totals only.
-- Also adds empty settings for the TikTok Pixel and the Android app link
-- (Admin → Marketing). Needs 0064_money.sql (app_settings) first.
-- Additive and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.campaign_visits (
  day date NOT NULL DEFAULT current_date,
  campaign text NOT NULL CHECK (campaign ~ '^[a-z0-9_-]{1,40}$'),
  source text NOT NULL CHECK (source ~ '^[a-z0-9_.-]{1,40}$'),
  visits int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, campaign, source)
);
ALTER TABLE public.campaign_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.campaign_visits TO authenticated;
GRANT ALL ON public.campaign_visits TO service_role;
DROP POLICY IF EXISTS campaign_visits_admin_read ON public.campaign_visits;
CREATE POLICY campaign_visits_admin_read ON public.campaign_visits FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.signup_sources (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign text,
  source text,
  medium text,
  landing text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_sources_created_idx ON public.signup_sources (created_at DESC);
ALTER TABLE public.signup_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_sources FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.signup_sources TO service_role;

-- Keeps only short, safe labels (a-z, 0-9, - _ .); anything else is dropped.
CREATE OR REPLACE FUNCTION private.campaign_label(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN lower(btrim(v)) ~ '^[a-z0-9_.-]{1,40}$' THEN lower(btrim(v)) END
$$;
REVOKE ALL ON FUNCTION private.campaign_label(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.record_campaign_visit(p_campaign text, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c text := private.campaign_label(p_campaign);
  s text := coalesce(private.campaign_label(p_source), 'direct');
BEGIN
  IF c IS NULL OR c !~ '^[a-z0-9_-]{1,40}$' THEN
    RETURN;
  END IF;
  INSERT INTO public.campaign_visits (day, campaign, source, visits)
  VALUES (current_date, c, s, 1)
  ON CONFLICT (day, campaign, source) DO UPDATE SET visits = public.campaign_visits.visits + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.record_campaign_visit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_campaign_visit(text, text) TO anon, authenticated;

-- Copies the attribution sent with the sign-up form, once the profile exists.
CREATE OR REPLACE FUNCTION private.save_signup_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a jsonb;
BEGIN
  SELECT u.raw_user_meta_data -> 'attribution' INTO a FROM auth.users u WHERE u.id = NEW.user_id;
  IF a IS NULL OR jsonb_typeof(a) <> 'object' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.signup_sources (user_id, campaign, source, medium, landing)
  VALUES (
    NEW.user_id,
    private.campaign_label(a ->> 'campaign'),
    private.campaign_label(a ->> 'source'),
    private.campaign_label(a ->> 'medium'),
    CASE WHEN (a ->> 'landing') ~ '^/[A-Za-z0-9/_.-]{0,99}$' THEN a ->> 'landing' END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.save_signup_source() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_signup_source ON public.profiles;
CREATE TRIGGER profiles_signup_source AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.save_signup_source();

-- Visits and sign-ups per campaign and source over the last N days.
CREATE OR REPLACE FUNCTION public.admin_campaign_stats(p_days int DEFAULT 30)
RETURNS TABLE (campaign text, source text, visits bigint, signups bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_revmate_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  WITH v AS (
    SELECT cv.campaign, cv.source, sum(cv.visits)::bigint AS visits
    FROM public.campaign_visits cv
    WHERE cv.day > current_date - greatest(1, least(p_days, 365))
    GROUP BY 1, 2
  ), s AS (
    SELECT coalesce(ss.campaign, '(none)') AS campaign, coalesce(ss.source, 'direct') AS source,
      count(*)::bigint AS signups
    FROM public.signup_sources ss
    WHERE ss.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
    GROUP BY 1, 2
  )
  SELECT coalesce(v.campaign, s.campaign), coalesce(v.source, s.source),
    coalesce(v.visits, 0), coalesce(s.signups, 0)
  FROM v FULL JOIN s ON s.campaign = v.campaign AND s.source = v.source
  ORDER BY 4 DESC, 3 DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_campaign_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_campaign_stats(int) TO authenticated;

INSERT INTO public.app_settings (key, value) VALUES
  ('tiktok_pixel_id', ''),
  ('android_package', ''),
  ('android_fingerprint', '')
ON CONFLICT (key) DO NOTHING;

COMMIT;
