CREATE OR REPLACE FUNCTION private.award_charger_host_badge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = NEW.user_id AND badge = 'community_charger') THEN
    INSERT INTO public.user_badges (user_id, badge) VALUES (NEW.user_id, 'community_charger') ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
    VALUES (NEW.user_id, NEW.user_id, 'badge', 'You earned the Community Charger badge!',
      '/u/' || (SELECT username FROM public.profiles WHERE user_id = NEW.user_id));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.award_charger_host_badge() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER charger_hosts_badge AFTER INSERT ON public.charger_hosts FOR EACH ROW EXECUTE FUNCTION private.award_charger_host_badge();