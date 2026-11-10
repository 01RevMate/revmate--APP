ALTER TABLE public.charge_requests ADD COLUMN IF NOT EXISTS review text;
ALTER TABLE public.charge_requests ADD CONSTRAINT charge_requests_review_len CHECK (review IS NULL OR char_length(review) <= 500) NOT VALID;

CREATE OR REPLACE FUNCTION public.leave_charge_review(p_request uuid, p_rating integer, p_review text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_rating NOT IN (-1, 1) THEN RAISE EXCEPTION 'Pick thumbs up or down'; END IF;
  UPDATE public.charge_requests
     SET rating = p_rating, review = NULLIF(left(btrim(coalesce(p_review, '')), 500), ''), updated_at = now()
   WHERE id = p_request AND requester_id = auth.uid() AND status IN ('done','expired') AND expires_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'You can review a host after an approved charge'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.charge_host_reviews(p_host uuid)
RETURNS TABLE(id uuid, reviewer_username text, reviewer_avatar text, rating smallint, review text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id, p.username, p.avatar_url, r.rating, r.review, r.updated_at
  FROM public.charge_requests r
  JOIN public.profiles p ON p.user_id = r.requester_id
  WHERE auth.uid() IS NOT NULL AND r.host_id = p_host AND r.rating IS NOT NULL
    AND coalesce(p.account_status::text, 'active') = 'active'
  ORDER BY r.updated_at DESC LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.leave_charge_review(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.charge_host_reviews(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_charge_review(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_host_reviews(uuid) TO authenticated;