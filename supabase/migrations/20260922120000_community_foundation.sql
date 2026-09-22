-- Run AFTER 0014_content_safety_admin.sql. User-applied; no existing posts are deleted.
BEGIN;
CREATE TABLE public.community_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(user_id),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 3 AND 80),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=1000),
 rules text NOT NULL DEFAULT '' CHECK(char_length(rules)<=5000),
 visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')),
 join_policy text NOT NULL DEFAULT 'open' CHECK(join_policy IN ('open','approval')),
 post_policy text NOT NULL DEFAULT 'member' CHECK(post_policy IN ('member','moderated')),
 make_name text, model_name text,
 member_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(visibility <> 'private' OR join_policy='approval'),
 CHECK(model_name IS NULL OR make_name IS NOT NULL)
);
CREATE TABLE public.group_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','moderator','member')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','banned')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(group_id,user_id)
);
CREATE INDEX group_members_user_status ON public.group_members(user_id,status,group_id);
CREATE INDEX group_members_queue ON public.group_members(group_id,status,requested_at);
CREATE INDEX community_groups_owner ON public.community_groups(owner_id);
ALTER TABLE public.posts ADD COLUMN group_id uuid REFERENCES public.community_groups(id),
 ADD COLUMN moderation_status text NOT NULL DEFAULT 'published' CHECK(moderation_status IN ('published','pending','rejected'));
CREATE INDEX posts_group_created ON public.posts(group_id,created_at DESC);

CREATE FUNCTION private.group_rank(gid uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN NOT private.is_active_account((SELECT auth.uid())) THEN 0
 WHEN private.is_revmate_admin((SELECT auth.uid())) THEN 5
 ELSE coalesce((SELECT CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END
 FROM public.group_members WHERE group_id=gid AND user_id=(SELECT auth.uid()) AND status='approved'),0) END;
$$;
CREATE FUNCTION private.group_access(gid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.community_groups WHERE id=gid AND
 (private.group_rank(gid)>0 OR (visibility='public' AND NOT EXISTS(
 SELECT 1 FROM public.group_members WHERE group_id=gid AND user_id=(SELECT auth.uid()) AND status='banned'))));
$$;
CREATE OR REPLACE FUNCTION private.can_view_post(check_post_id uuid, viewer_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.posts p WHERE p.id=check_post_id AND
 (private.is_revmate_admin(viewer_id) OR (
 private.is_active_account(p.user_id) AND (viewer_id IS NULL OR (private.is_active_account(viewer_id) AND NOT private.users_are_blocked(p.user_id,viewer_id)))
 AND (p.group_id IS NULL OR private.group_access(p.group_id))
 AND (p.moderation_status='published' OR p.user_id=viewer_id OR private.group_rank(p.group_id)>=2))));
$$;
CREATE FUNCTION private.group_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.group_members(group_id,user_id,role,status) VALUES(NEW.id,NEW.owner_id,'owner','approved');
 RETURN NEW;
END; $$;
CREATE FUNCTION private.group_member_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Atomic deltas avoid losing updates when two people join concurrently.
 IF TG_OP <> 'INSERT' AND OLD.status='approved' THEN
 UPDATE public.community_groups SET member_count=member_count-1 WHERE id=OLD.group_id;
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.status='approved' THEN
 UPDATE public.community_groups SET member_count=member_count+1 WHERE id=NEW.group_id;
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER group_member_count AFTER INSERT OR UPDATE OR DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION private.group_member_count();
CREATE TRIGGER group_created AFTER INSERT ON public.community_groups FOR EACH ROW EXECUTE FUNCTION private.group_created();

-- Membership transitions are available only through this checked RPC, never direct client updates.
CREATE FUNCTION public.manage_group_member(gid uuid, target_user uuid, action text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := (SELECT auth.uid()); actor_rank integer; target public.group_members; grp public.community_groups;
BEGIN
 IF NOT private.is_active_account(actor) THEN RAISE EXCEPTION 'Sign in with an active account'; END IF;
 SELECT * INTO grp FROM public.community_groups WHERE id=gid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
 SELECT * INTO target FROM public.group_members WHERE group_id=gid AND user_id=target_user FOR UPDATE;
 actor_rank := private.group_rank(gid);
 IF action='join' THEN
  IF actor<>target_user THEN RAISE EXCEPTION 'Join as yourself'; END IF;
  IF target.id IS NOT NULL THEN RAISE EXCEPTION 'You already have a membership or request'; END IF;
  INSERT INTO public.group_members(group_id,user_id,status) VALUES(gid,actor,CASE WHEN grp.join_policy='open' THEN 'approved' ELSE 'pending' END);
 ELSIF action='leave' THEN
  IF actor<>target_user OR target.role='owner' OR target.status IN ('banned','rejected') THEN RAISE EXCEPTION 'This membership cannot be removed'; END IF;
  DELETE FROM public.group_members WHERE id=target.id;
 ELSE
  IF target.id IS NULL OR target.role='owner' OR actor=target_user OR actor_rank<2
   OR actor_rank <= (CASE target.role WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END)
   THEN RAISE EXCEPTION 'You cannot manage this member'; END IF;
  IF action IN ('approved','rejected','banned') THEN
   UPDATE public.group_members SET status=action WHERE id=target.id;
  ELSIF action IN ('admin','moderator','member') THEN
   IF actor_rank<4 OR target.status<>'approved' THEN RAISE EXCEPTION 'Only the owner can assign roles to approved members'; END IF;
   UPDATE public.group_members SET role=action WHERE id=target.id;
  ELSE RAISE EXCEPTION 'Unknown membership action'; END IF;
 END IF;
END; $$;

CREATE FUNCTION private.prepare_group_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Post author and destination cannot be changed'; END IF;
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status AND NOT (private.is_revmate_admin((SELECT auth.uid())) OR private.group_rank(OLD.group_id)>=2) THEN RAISE EXCEPTION 'Only moderators can review posts'; END IF;
  IF NEW.body IS DISTINCT FROM OLD.body AND NEW.group_id IS NOT NULL AND private.group_rank(NEW.group_id)<2
   AND EXISTS(SELECT 1 FROM public.community_groups WHERE id=NEW.group_id AND post_policy='moderated') THEN NEW.moderation_status:='pending'; END IF;
 ELSE
  NEW.moderation_status:='published';
  IF NEW.group_id IS NOT NULL THEN
   IF private.group_rank(NEW.group_id)<1 THEN RAISE EXCEPTION 'Join this group before posting'; END IF;
   IF private.group_rank(NEW.group_id)<2 AND EXISTS(SELECT 1 FROM public.community_groups WHERE id=NEW.group_id AND post_policy='moderated') THEN NEW.moderation_status:='pending'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER prepare_group_post BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION private.prepare_group_post();
CREATE FUNCTION public.review_group_post(pid uuid, decision text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE gid uuid;
BEGIN
 SELECT group_id INTO gid FROM public.posts WHERE id=pid FOR UPDATE;
 IF gid IS NULL OR private.group_rank(gid)<2 OR decision NOT IN ('published','rejected') THEN RAISE EXCEPTION 'You cannot review this post'; END IF;
 UPDATE public.posts SET moderation_status=decision WHERE id=pid;
END; $$;

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_groups,public.group_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.community_groups TO anon,authenticated;
GRANT INSERT(name,slug,description,owner_id,visibility,join_policy,post_policy,make_name,model_name), UPDATE(name,description,rules,post_policy) ON public.community_groups TO authenticated;
GRANT SELECT ON public.group_members TO authenticated;
GRANT ALL ON public.community_groups,public.group_members TO service_role;
CREATE POLICY group_directory ON public.community_groups FOR SELECT USING(true);
CREATE POLICY group_create ON public.community_groups FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())));
CREATE POLICY group_edit ON public.community_groups FOR UPDATE TO authenticated USING(private.group_rank(id)>=3) WITH CHECK(private.group_rank(id)>=3);
CREATE POLICY group_member_read ON public.group_members FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR private.group_rank(group_id)>=1);
DROP POLICY "Visible posts are viewable" ON public.posts;
CREATE POLICY "Visible posts are viewable" ON public.posts FOR SELECT USING(
 private.is_revmate_admin((SELECT auth.uid())) OR (
 private.is_active_account(user_id)
 AND ((SELECT auth.uid()) IS NULL OR (private.is_active_account((SELECT auth.uid())) AND NOT private.users_are_blocked(user_id,(SELECT auth.uid()))))
 AND (group_id IS NULL OR private.group_access(group_id))
 AND (moderation_status='published' OR user_id=(SELECT auth.uid()) OR private.group_rank(group_id)>=2))
);
-- Restrictive policies compose with existing author rules rather than broadening them.
CREATE POLICY group_post_insert ON public.posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(group_id IS NULL OR private.group_rank(group_id)>=1);
CREATE POLICY group_post_update ON public.posts AS RESTRICTIVE FOR UPDATE TO authenticated USING(group_id IS NULL OR private.group_rank(group_id)>=1) WITH CHECK(group_id IS NULL OR private.group_rank(group_id)>=1);
CREATE POLICY group_comment_insert ON public.post_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id AND (p.group_id IS NULL OR private.group_rank(p.group_id)>=1)));
CREATE POLICY group_like_insert ON public.post_likes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id AND (p.group_id IS NULL OR private.group_rank(p.group_id)>=1)));

-- Group images use a PRIVATE bucket; existing public post images are unaffected.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('group-images','group-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']);
CREATE POLICY group_image_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='group-images' AND EXISTS(
 SELECT 1 FROM public.posts p WHERE p.id::text=(storage.foldername(name))[2] AND private.can_view_post(p.id,(SELECT auth.uid()))));
CREATE POLICY group_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='group-images' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND EXISTS(
 SELECT 1 FROM public.posts p WHERE p.id::text=(storage.foldername(name))[2] AND p.user_id=(SELECT auth.uid()) AND p.group_id IS NOT NULL AND private.group_rank(p.group_id)>=1));
CREATE POLICY group_image_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='group-images' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE FUNCTION private.check_post_image() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.posts;
BEGIN
 SELECT * INTO p FROM public.posts WHERE id=NEW.post_id FOR UPDATE;
 IF NOT private.is_active_account((SELECT auth.uid())) OR p.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN RAISE EXCEPTION 'Upload to your own post'; END IF;
 IF (SELECT count(*) FROM public.post_images WHERE post_id=NEW.post_id)>=5 THEN RAISE EXCEPTION 'Maximum five images per post'; END IF;
 IF p.group_id IS NOT NULL AND (private.group_rank(p.group_id)<1 OR NEW.image_url NOT LIKE 'group-images:'||p.user_id::text||'/'||p.id::text||'/%') THEN RAISE EXCEPTION 'Group photos must use protected storage'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER check_post_image BEFORE INSERT ON public.post_images FOR EACH ROW EXECUTE FUNCTION private.check_post_image();

CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('comment','like','join_request','membership')),
 post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
 group_id uuid REFERENCES public.community_groups(id) ON DELETE CASCADE,
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created ON public.notifications(user_id,created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.notifications TO authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
CREATE POLICY notification_read ON public.notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND private.is_active_account(user_id) AND NOT private.users_are_blocked(user_id,actor_id) AND (post_id IS NULL OR private.can_view_post(post_id,user_id)));
CREATE POLICY notification_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY notification_delete ON public.notifications FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION private.notify_social_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid;
BEGIN
 IF TG_TABLE_NAME='group_members' THEN
  IF TG_OP='INSERT' AND NEW.status='pending' THEN
   INSERT INTO public.notifications(user_id,actor_id,kind,group_id)
   SELECT user_id,NEW.user_id,'join_request',NEW.group_id FROM public.group_members WHERE group_id=NEW.group_id AND status='approved' AND role IN ('owner','admin','moderator');
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.notifications(user_id,actor_id,kind,group_id) VALUES(NEW.user_id,(SELECT auth.uid()),'membership',NEW.group_id);
  END IF;
 ELSE
  SELECT user_id INTO recipient FROM public.posts WHERE id=NEW.post_id;
  IF recipient<>NEW.user_id AND NOT private.users_are_blocked(recipient,NEW.user_id) AND NOT EXISTS(
   SELECT 1 FROM public.notifications WHERE user_id=recipient AND actor_id=NEW.user_id AND post_id=NEW.post_id AND kind=CASE WHEN TG_TABLE_NAME='post_likes' THEN 'like' ELSE 'comment' END AND created_at>now()-interval '1 minute') THEN
   INSERT INTO public.notifications(user_id,actor_id,kind,post_id) VALUES(recipient,NEW.user_id,CASE WHEN TG_TABLE_NAME='post_likes' THEN 'like' ELSE 'comment' END,NEW.post_id);
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER notify_group_member AFTER INSERT OR UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();
CREATE TRIGGER notify_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();
CREATE TRIGGER notify_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

REVOKE ALL ON FUNCTION private.group_rank(uuid),private.group_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.group_rank(uuid),private.group_access(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION private.group_created(),private.group_member_count(),private.prepare_group_post(),private.check_post_image(),private.notify_social_activity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.manage_group_member(uuid,uuid,text),public.review_group_post(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_group_member(uuid,uuid,text),public.review_group_post(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION private.protect_report_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ON DELETE SET NULL preserves the report when its post is removed. This
  -- internal foreign-key update must also work when the author deletes a post.
  IF OLD.post_id IS NOT NULL AND NEW.post_id IS NULL
    AND NEW.reporter_id IS NOT DISTINCT FROM OLD.reporter_id
    AND NEW.reported_user_id IS NOT DISTINCT FROM OLD.reported_user_id
    AND NEW.reason IS NOT DISTINCT FROM OLD.reason
    AND NEW.details IS NOT DISTINCT FROM OLD.details
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by
    AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
    RETURN NEW;
  END IF;

  IF NOT (private.is_revmate_admin((SELECT auth.uid())) OR private.group_rank((SELECT group_id FROM public.posts WHERE id=OLD.post_id))>=2) THEN
    RAISE EXCEPTION 'Only a moderator can review reports';
  END IF;
  IF NEW.post_id IS DISTINCT FROM OLD.post_id
    OR NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
    OR NEW.reported_user_id IS DISTINCT FROM OLD.reported_user_id
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.details IS DISTINCT FROM OLD.details
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Report evidence cannot be changed';
  END IF;
  NEW.reviewed_by := (SELECT auth.uid());
  NEW.reviewed_at := now();
  RETURN NEW;
END;
$$;


CREATE POLICY group_report_read ON public.post_reports FOR SELECT TO authenticated USING(private.group_rank((SELECT group_id FROM public.posts WHERE id=post_id))>=2);
CREATE POLICY group_report_review ON public.post_reports FOR UPDATE TO authenticated USING(private.group_rank((SELECT group_id FROM public.posts WHERE id=post_id))>=2) WITH CHECK(private.group_rank((SELECT group_id FROM public.posts WHERE id=post_id))>=2);
CREATE POLICY group_comment_update ON public.post_comments AS RESTRICTIVE FOR UPDATE TO authenticated
USING(private.can_view_post(post_id,(SELECT auth.uid()))) WITH CHECK(private.can_view_post(post_id,(SELECT auth.uid())) AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post_id AND (p.group_id IS NULL OR private.group_rank(p.group_id)>=1)));

-- Filter before pagination: an owner's relevant posts must not disappear behind unrelated recent posts.
CREATE FUNCTION public.community_feed(filter_scope text DEFAULT 'all', filter_car uuid DEFAULT NULL, filter_category text DEFAULT 'all', page_offset integer DEFAULT 0)
RETURNS SETOF public.posts LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.posts p
 WHERE p.moderation_status='published'
 AND (filter_category='all' OR p.category::text=filter_category)
 AND CASE
 WHEN filter_scope='my_groups' THEN EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id=p.group_id AND gm.user_id=(SELECT auth.uid()) AND gm.status='approved')
 WHEN filter_scope IN ('my_car','same_brand') THEN p.group_id IS NULL AND EXISTS(
  SELECT 1 FROM public.garage_cars posted JOIN public.garage_cars owned ON lower(btrim(owned.make))=lower(btrim(posted.make))
  WHERE posted.id=p.posted_as_garage_car_id AND owned.user_id=(SELECT auth.uid()) AND owned.ownership_status='current'
   AND (filter_car IS NULL OR owned.id=filter_car)
   AND (filter_scope='same_brand' OR lower(btrim(owned.model))=lower(btrim(posted.model))))
 WHEN filter_scope='popular' THEN p.group_id IS NULL AND p.created_at>now()-interval '7 days'
 WHEN filter_scope='all' THEN p.group_id IS NULL
 ELSE false END
 ORDER BY CASE WHEN filter_scope='popular' THEN p.likes_count ELSE 0 END DESC,p.created_at DESC,p.id DESC
 LIMIT 30 OFFSET greatest(0,least(page_offset,10000));
$$;
REVOKE ALL ON FUNCTION public.community_feed(text,uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed(text,uuid,text,integer) TO anon,authenticated;
COMMIT;
