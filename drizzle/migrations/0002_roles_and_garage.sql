-- ROLES (admin vs regular user) + PERSONA (how the user describes themselves)
CREATE TYPE public.profile_role AS ENUM ('user', 'admin');
CREATE TYPE public.profile_persona AS ENUM ('owner', 'modifier', 'enthusiast', 'diy_mechanic', 'trader');

ALTER TABLE public.profiles ADD COLUMN role public.profile_role NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN persona public.profile_persona NOT NULL DEFAULT 'owner';

-- helper used by RLS policies elsewhere so a profile row never has to be
-- re-fetched client-side just to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = check_user_id AND role = 'admin'
  );
$$;

-- a user can update their own username/avatar/persona (already allowed by the
-- existing "Users update own profile" policy), but must never be able to grant
-- themselves admin — only an existing admin, or a direct service-role change,
-- may change `role`.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can change a profile role';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_profile_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- admins can additionally verify/unverify car pages
CREATE POLICY "Admins update cars" ON public.cars FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- GARAGE: the cars a user actually owns (distinct from saved_cars, which are
-- just bookmarks). Simple mode: make/model text only. Advanced mode: link to
-- the cars catalog via car_id, add year/spec/nickname and mods below.
CREATE TABLE public.garage_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  make text NOT NULL,
  model text NOT NULL,
  generation text,
  year int,
  nickname text,
  spec text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX garage_cars_user_id_idx ON public.garage_cars(user_id);
GRANT SELECT ON public.garage_cars TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_cars TO authenticated;
GRANT ALL ON public.garage_cars TO service_role;
ALTER TABLE public.garage_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Garage cars are viewable by everyone" ON public.garage_cars FOR SELECT USING (true);
CREATE POLICY "Users add to own garage" ON public.garage_cars FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own garage cars" ON public.garage_cars FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own garage cars" ON public.garage_cars FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MODS: modifications logged against a garage car, for the modifier/enthusiast crowd
CREATE TABLE public.garage_mods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX garage_mods_garage_car_id_idx ON public.garage_mods(garage_car_id);
GRANT SELECT ON public.garage_mods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_mods TO authenticated;
GRANT ALL ON public.garage_mods TO service_role;
ALTER TABLE public.garage_mods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mods are viewable by everyone" ON public.garage_mods FOR SELECT USING (true);
CREATE POLICY "Users add mods to own garage cars" ON public.garage_mods FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.garage_cars gc WHERE gc.id = garage_car_id AND gc.user_id = auth.uid())
);
CREATE POLICY "Users update mods on own garage cars" ON public.garage_mods FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.garage_cars gc WHERE gc.id = garage_car_id AND gc.user_id = auth.uid())
);
CREATE POLICY "Users delete mods on own garage cars" ON public.garage_mods FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.garage_cars gc WHERE gc.id = garage_car_id AND gc.user_id = auth.uid())
);
