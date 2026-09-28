-- STEP 8 — Pop-up announcements (admin messages shown when members open
-- the app)
-- Copy of drizzle/migrations/0042_announcements.sql
-- Run the whole file once. Steps 1–7 are already applied.

-- Pop-up announcements shown to signed-in members when they open the app.
-- Run after 0037_age_and_consent.sql.
--
-- Admins create them (prefilled from the latest app update or written from
-- scratch), choose when they run and who sees them, and can switch them off.
-- Each member sees an announcement once; closing it or tapping its button
-- is recorded so admins can see how many people saw and tapped it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('update', 'custom')),
  release_version text,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 2000),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  cta_label text CHECK (cta_label IS NULL OR char_length(btrim(cta_label)) BETWEEN 1 AND 40),
  -- An internal path (/garage) or an https link.
  cta_url text CHECK (cta_url IS NULL OR cta_url ~ '^(/[^/]|/$|https://)'),
  audience text NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'adults', 'under_18')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK ((cta_label IS NULL) = (cta_url IS NULL))
);
CREATE INDEX IF NOT EXISTS announcements_live_idx ON public.announcements(active, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.announcement_views (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  clicked boolean NOT NULL DEFAULT false,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- Who an announcement is for. Unknown ages (accounts that haven't confirmed
-- yet) count as adults, matching private.age_at_least.
CREATE OR REPLACE FUNCTION private.announcement_for_viewer(target public.announcements) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE target.audience
    WHEN 'everyone' THEN true
    WHEN 'adults' THEN coalesce(
      (SELECT extract(year FROM age((now() AT TIME ZONE 'Europe/London')::date, c.birth_date)) >= 18
       FROM public.account_consents c
       WHERE c.user_id = (SELECT auth.uid()) AND c.birth_date IS NOT NULL), true)
    ELSE coalesce(
      (SELECT extract(year FROM age((now() AT TIME ZONE 'Europe/London')::date, c.birth_date)) < 18
       FROM public.account_consents c
       WHERE c.user_id = (SELECT auth.uid()) AND c.birth_date IS NOT NULL), false)
  END
$$;
REVOKE ALL ON FUNCTION private.announcement_for_viewer(public.announcements) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.announcement_for_viewer(public.announcements) TO authenticated;

CREATE OR REPLACE FUNCTION private.stamp_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_by := (SELECT auth.uid()); NEW.created_at := now(); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS stamp_announcement ON public.announcements;
CREATE TRIGGER stamp_announcement BEFORE INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION private.stamp_announcement();
REVOKE ALL ON FUNCTION private.stamp_announcement() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcements, public.announcement_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT ON public.announcement_views TO authenticated;
GRANT UPDATE (clicked) ON public.announcement_views TO authenticated;
GRANT ALL ON public.announcements, public.announcement_views TO service_role;

DROP POLICY IF EXISTS announcements_read ON public.announcements;
CREATE POLICY announcements_read ON public.announcements FOR SELECT TO authenticated USING (
  private.is_revmate_admin((SELECT auth.uid()))
  OR (active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
      AND private.announcement_for_viewer(announcements))
);
DROP POLICY IF EXISTS announcements_admin_insert ON public.announcements;
CREATE POLICY announcements_admin_insert ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS announcements_admin_update ON public.announcements;
CREATE POLICY announcements_admin_update ON public.announcements FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS announcements_admin_delete ON public.announcements;
CREATE POLICY announcements_admin_delete ON public.announcements FOR DELETE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS announcement_views_read ON public.announcement_views;
CREATE POLICY announcement_views_read ON public.announcement_views FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS announcement_views_insert ON public.announcement_views;
CREATE POLICY announcement_views_insert ON public.announcement_views FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS announcement_views_update ON public.announcement_views;
CREATE POLICY announcement_views_update ON public.announcement_views FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Seen / tapped counts for the admin list.
CREATE OR REPLACE FUNCTION public.announcement_stats()
RETURNS TABLE (announcement_id uuid, seen bigint, clicked bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_revmate_admin((SELECT auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT v.announcement_id, count(*), count(*) FILTER (WHERE v.clicked)
    FROM public.announcement_views v GROUP BY v.announcement_id;
END; $$;
REVOKE ALL ON FUNCTION public.announcement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announcement_stats() TO authenticated;

COMMIT;
