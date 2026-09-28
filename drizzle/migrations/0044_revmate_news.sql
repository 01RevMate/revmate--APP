-- RevMate News: official posts written by admins (app updates, news,
-- sponsorships, fuel prices…) that appear in everyone's feed at the time
-- they were published, shown as "RevMate" with a topic label. They can be
-- liked but not commented on, shared or reposted, and admins can switch
-- each one on or off. Run after 0043_listing_details.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL CHECK (char_length(btrim(topic)) BETWEEN 2 AND 30),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000),
  -- Images and videos (public URLs), shown in order.
  media text[] NOT NULL DEFAULT '{}' CHECK (cardinality(media) <= 10),
  cta_label text CHECK (cta_label IS NULL OR char_length(btrim(cta_label)) BETWEEN 1 AND 40),
  cta_url text CHECK (cta_url IS NULL OR cta_url ~ '^(/[^/]|/$|https://)'),
  sponsored boolean NOT NULL DEFAULT false,
  -- Where it sits in the feed. A future time schedules it.
  published_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  likes_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((cta_label IS NULL) = (cta_url IS NULL))
);
CREATE INDEX IF NOT EXISTS news_posts_feed_idx ON public.news_posts (active, published_at DESC);

CREATE TABLE IF NOT EXISTS public.news_likes (
  news_id uuid NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);
CREATE INDEX IF NOT EXISTS news_likes_user_idx ON public.news_likes (user_id);

-- Stamp the author and protect the like counter.
CREATE OR REPLACE FUNCTION private.guard_news_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.likes_count := 0;
  ELSIF current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    NEW.likes_count := OLD.likes_count;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_news_post ON public.news_posts;
CREATE TRIGGER guard_news_post BEFORE INSERT OR UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION private.guard_news_post();

CREATE OR REPLACE FUNCTION private.count_news_likes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_posts SET likes_count = likes_count + 1 WHERE id = NEW.news_id;
  ELSE
    UPDATE public.news_posts SET likes_count = greatest(likes_count - 1, 0) WHERE id = OLD.news_id;
  END IF;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS count_news_likes ON public.news_likes;
CREATE TRIGGER count_news_likes AFTER INSERT OR DELETE ON public.news_likes
  FOR EACH ROW EXECUTE FUNCTION private.count_news_likes();
REVOKE ALL ON FUNCTION private.guard_news_post(), private.count_news_likes() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_posts, public.news_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.news_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.news_likes TO authenticated;
GRANT ALL ON public.news_posts, public.news_likes TO service_role;

DROP POLICY IF EXISTS news_posts_read ON public.news_posts;
CREATE POLICY news_posts_read ON public.news_posts FOR SELECT USING (
  (active AND published_at <= now()) OR private.is_revmate_admin((SELECT auth.uid()))
);
DROP POLICY IF EXISTS news_posts_admin_insert ON public.news_posts;
CREATE POLICY news_posts_admin_insert ON public.news_posts FOR INSERT TO authenticated
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS news_posts_admin_update ON public.news_posts;
CREATE POLICY news_posts_admin_update ON public.news_posts FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS news_posts_admin_delete ON public.news_posts;
CREATE POLICY news_posts_admin_delete ON public.news_posts FOR DELETE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS news_likes_own_read ON public.news_likes;
CREATE POLICY news_likes_own_read ON public.news_likes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS news_likes_own_insert ON public.news_likes;
CREATE POLICY news_likes_own_insert ON public.news_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND private.is_active_account((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.news_posts n
                WHERE n.id = news_id AND n.active AND n.published_at <= now())
  );
DROP POLICY IF EXISTS news_likes_own_delete ON public.news_likes;
CREATE POLICY news_likes_own_delete ON public.news_likes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;
