CREATE TABLE public.home_charger_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_slug text NOT NULL CHECK (char_length(charger_slug) BETWEEN 1 AND 60),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charger_slug, user_id)
);
GRANT SELECT ON public.home_charger_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_charger_reviews TO authenticated;
GRANT ALL ON public.home_charger_reviews TO service_role;
ALTER TABLE public.home_charger_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read home charger reviews" ON public.home_charger_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Members add own review" ON public.home_charger_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members edit own review" ON public.home_charger_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members delete own review" ON public.home_charger_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);