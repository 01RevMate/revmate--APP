-- SOCIAL LINKS (profile-level, not per-car)
ALTER TABLE public.profiles ADD COLUMN social_instagram text;
ALTER TABLE public.profiles ADD COLUMN social_facebook text;
ALTER TABLE public.profiles ADD COLUMN social_tiktok text;

-- FRIENDS
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted');
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id),
  UNIQUE (requester_id, recipient_id)
);
CREATE INDEX friendships_requester_id_idx ON public.friendships(requester_id);
CREATE INDEX friendships_recipient_id_idx ON public.friendships(recipient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view their friendships" ON public.friendships FOR SELECT TO authenticated USING (
  auth.uid() = requester_id OR auth.uid() = recipient_id
);
CREATE POLICY "Users send friend requests" ON public.friendships FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = requester_id
);
CREATE POLICY "Recipient accepts a request" ON public.friendships FOR UPDATE TO authenticated USING (
  auth.uid() = recipient_id
) WITH CHECK (status = 'accepted');
CREATE POLICY "Participants remove a friendship" ON public.friendships FOR DELETE TO authenticated USING (
  auth.uid() = requester_id OR auth.uid() = recipient_id
);

-- GARAGE CAR LIKES (separate from post_likes — likes on a car build itself)
ALTER TABLE public.garage_cars ADD COLUMN likes_count int NOT NULL DEFAULT 0;
CREATE TABLE public.garage_car_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (garage_car_id, user_id)
);
CREATE INDEX garage_car_likes_garage_car_id_idx ON public.garage_car_likes(garage_car_id);
GRANT SELECT ON public.garage_car_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.garage_car_likes TO authenticated;
GRANT ALL ON public.garage_car_likes TO service_role;
ALTER TABLE public.garage_car_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Car likes are viewable by everyone" ON public.garage_car_likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.garage_car_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own car like" ON public.garage_car_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_garage_car_like_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.garage_cars SET likes_count = likes_count + 1 WHERE id = NEW.garage_car_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.garage_cars SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.garage_car_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER on_garage_car_like_change
AFTER INSERT OR DELETE ON public.garage_car_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_garage_car_like_change();

-- MESSAGES (1:1 DMs between friends)
-- user_a/user_b are always stored with user_a < user_b (enforced below and by
-- the app always sorting the pair first) so the pair can't be duplicated in
-- reverse order.
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX conversations_user_a_idx ON public.conversations(user_a);
CREATE INDEX conversations_user_b_idx ON public.conversations(user_b);
GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view their conversations" ON public.conversations FOR SELECT TO authenticated USING (
  auth.uid() = user_a OR auth.uid() = user_b
);
CREATE POLICY "Users start a conversation they're part of" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_a OR auth.uid() = user_b
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages in their conversations" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
CREATE POLICY "Participants send messages as themselves" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
CREATE POLICY "Recipient marks messages read" ON public.messages FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
