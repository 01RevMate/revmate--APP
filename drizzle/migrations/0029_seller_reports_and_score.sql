CREATE TABLE public.seller_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('scam','not_as_described','no_show','abusive','other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);

GRANT SELECT, INSERT ON public.seller_reports TO authenticated;
GRANT ALL ON public.seller_reports TO service_role;

ALTER TABLE public.seller_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report sellers"
ON public.seller_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id AND reporter_id <> seller_id);

CREATE POLICY "Reporters and admins can read reports"
ON public.seller_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
ON public.seller_reports FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.seller_score(target_user uuid)
RETURNS TABLE(listings_count bigint, actioned_reports bigint, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.listings l WHERE l.user_id = target_user),
    (SELECT count(*) FROM public.seller_reports r WHERE r.seller_id = target_user AND r.status = 'actioned'),
    GREATEST(1, ROUND(5 - 0.5 * (SELECT count(*) FROM public.seller_reports r WHERE r.seller_id = target_user AND r.status = 'actioned'), 1));
$$;

REVOKE ALL ON FUNCTION public.seller_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_score(uuid) TO anon, authenticated;