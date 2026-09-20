-- Public profile/garage pages need a unique, stable handle to route on
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
ALTER TABLE public.profiles ADD COLUMN cover_photo_url text;

-- Every garage car needs its own photo and a name, since posting "as" a car
-- with no distinguishing name would just show up as a generic "BMW X5" for
-- every owner of one. Backfill existing rows before enforcing NOT NULL.
ALTER TABLE public.garage_cars ADD COLUMN photo_url text;
UPDATE public.garage_cars SET nickname = make || ' ' || model WHERE nickname IS NULL;
ALTER TABLE public.garage_cars ALTER COLUMN nickname SET NOT NULL;

-- POSTS: allow posting "as" one of your own garage cars instead of yourself
ALTER TABLE public.posts ADD COLUMN posted_as_garage_car_id uuid REFERENCES public.garage_cars(id) ON DELETE SET NULL;

DROP POLICY "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND (
    posted_as_garage_car_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.garage_cars gc WHERE gc.id = posted_as_garage_car_id AND gc.user_id = auth.uid()
    )
  )
);
