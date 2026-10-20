-- Auctions on Buy & Sell (eBay-style) for cars and parts.
--
--   * A listing can be "fixed" price (as now) or an "auction" with a start
--     price, an end time and an optional hidden reserve.
--   * Bids go through place_bid(): minimum increments, no bidding on your own
--     listing, adults only, blocked users can't bid on each other, and a bid
--     in the last 2 minutes extends the auction by 2 minutes (no sniping).
--   * Bidders are anonymous to everyone else ("Bidder 1, 2…"). The reserve is
--     never shown, only whether it's been met.
--   * Once there are bids the seller can't change the price, terms or end
--     time, or delete or end the listing early.
--   * settle_due_auctions() closes finished auctions and tells the winner and
--     seller. The app calls it every few minutes, so no scheduler is needed.
--
-- Needs 0067_store.sql (notification kinds). Additive and safe to re-run.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sale_format text NOT NULL DEFAULT 'fixed' CHECK (sale_format IN ('fixed', 'auction')),
  ADD COLUMN IF NOT EXISTS auction_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_price numeric CHECK (start_price IS NULL OR (start_price >= 1 AND start_price <= 10000000)),
  ADD COLUMN IF NOT EXISTS current_bid numeric,
  ADD COLUMN IF NOT EXISTS bid_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_reserve boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserve_met boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auction_settled_at timestamptz;
CREATE INDEX IF NOT EXISTS listings_auction_due_idx ON public.listings (auction_ends_at)
  WHERE sale_format = 'auction' AND auction_settled_at IS NULL;

-- Private auction details: the reserve and who's winning.
CREATE TABLE IF NOT EXISTS public.listing_auctions (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  reserve_price numeric CHECK (reserve_price IS NULL OR (reserve_price >= 1 AND reserve_price <= 10000000)),
  top_bidder_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.listing_auctions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_auctions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.listing_auctions TO authenticated;
GRANT ALL ON public.listing_auctions TO service_role;
DROP POLICY IF EXISTS listing_auctions_read ON public.listing_auctions;
CREATE POLICY listing_auctions_read ON public.listing_auctions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = (SELECT auth.uid()))
  OR private.is_revmate_admin((SELECT auth.uid()))
);

CREATE TABLE IF NOT EXISTS public.listing_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 1 AND amount <= 10000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_bids_listing_idx ON public.listing_bids (listing_id, amount DESC);
CREATE INDEX IF NOT EXISTS listing_bids_bidder_idx ON public.listing_bids (bidder_id, created_at DESC);
ALTER TABLE public.listing_bids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_bids FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.listing_bids TO authenticated;
GRANT ALL ON public.listing_bids TO service_role;
DROP POLICY IF EXISTS listing_bids_own ON public.listing_bids;
CREATE POLICY listing_bids_own ON public.listing_bids FOR SELECT TO authenticated USING (
  bidder_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid()))
);

-- Bid steps, like eBay's.
CREATE OR REPLACE FUNCTION private.bid_increment(current numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN current < 100 THEN 1
    WHEN current < 1000 THEN 10
    WHEN current < 5000 THEN 50
    WHEN current < 20000 THEN 100
    ELSE 250
  END::numeric
$$;
REVOKE ALL ON FUNCTION private.bid_increment(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.bid_increment(numeric) TO anon, authenticated;

-- Sellers set up auctions; bid figures only change through place_bid().
CREATE OR REPLACE FUNCTION private.guard_listing_auction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin boolean := private.is_revmate_admin((SELECT auth.uid()));
BEGIN
  IF current_setting('revmate.auction_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.current_bid := NULL;
    NEW.bid_count := 0;
    NEW.has_reserve := false;
    NEW.reserve_met := false;
    NEW.auction_settled_at := NULL;
    IF NEW.sale_format = 'auction' THEN
      IF NEW.start_price IS NULL THEN
        RAISE EXCEPTION 'Set a starting price for your auction.' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.auction_ends_at IS NULL OR NEW.auction_ends_at < now() + interval '1 hour'
        OR NEW.auction_ends_at > now() + interval '15 days' THEN
        RAISE EXCEPTION 'Auctions run for 1 hour to 14 days.' USING ERRCODE = 'check_violation';
      END IF;
      NEW.start_price := round(NEW.start_price);
      NEW.price := NEW.start_price;
    ELSE
      NEW.auction_ends_at := NULL;
      NEW.start_price := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.current_bid := OLD.current_bid;
  NEW.bid_count := OLD.bid_count;
  NEW.has_reserve := OLD.has_reserve;
  NEW.reserve_met := OLD.reserve_met;
  NEW.auction_settled_at := OLD.auction_settled_at;
  IF OLD.sale_format = 'auction' AND OLD.bid_count > 0 AND NOT admin THEN
    NEW.sale_format := OLD.sale_format;
    NEW.start_price := OLD.start_price;
    NEW.auction_ends_at := OLD.auction_ends_at;
    NEW.price := OLD.price;
    IF OLD.auction_settled_at IS NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'This auction has bids, so it has to run until it ends.' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.sale_format = 'auction' AND (
    NEW.sale_format IS DISTINCT FROM OLD.sale_format
    OR NEW.auction_ends_at IS DISTINCT FROM OLD.auction_ends_at
  ) THEN
    IF NEW.start_price IS NULL OR NEW.auction_ends_at IS NULL
      OR NEW.auction_ends_at < now() + interval '1 hour'
      OR NEW.auction_ends_at > now() + interval '15 days' THEN
      RAISE EXCEPTION 'Auctions need a starting price and run for 1 hour to 14 days.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.sale_format = 'auction' AND NEW.start_price IS NOT NULL AND OLD.bid_count = 0 THEN
    NEW.start_price := round(NEW.start_price);
    NEW.price := NEW.start_price;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_listing_auction() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_listing_auction ON public.listings;
CREATE TRIGGER guard_listing_auction BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.guard_listing_auction();

CREATE OR REPLACE FUNCTION private.guard_listing_auction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.sale_format = 'auction' AND OLD.bid_count > 0 AND OLD.auction_settled_at IS NULL
    AND NOT private.is_revmate_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'This auction has bids, so it can''t be deleted until it ends.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_listing_auction_delete() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_listing_auction_delete ON public.listings;
CREATE TRIGGER guard_listing_auction_delete BEFORE DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.guard_listing_auction_delete();

-- Seller sets (or clears) a hidden reserve, before the first bid.
CREATE OR REPLACE FUNCTION public.set_auction_reserve(target_listing uuid, reserve numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = target_listing FOR UPDATE;
  IF NOT FOUND OR l.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not your listing.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF l.sale_format <> 'auction' OR l.bid_count > 0 THEN
    RAISE EXCEPTION 'The reserve can only be set before the first bid.' USING ERRCODE = 'check_violation';
  END IF;
  IF reserve IS NOT NULL AND (reserve < coalesce(l.start_price, 1) OR reserve > 10000000) THEN
    RAISE EXCEPTION 'The reserve must be at least the starting price.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.listing_auctions (listing_id, reserve_price)
  VALUES (target_listing, round(reserve))
  ON CONFLICT (listing_id) DO UPDATE SET reserve_price = EXCLUDED.reserve_price;
  PERFORM set_config('revmate.auction_update', 'on', true);
  UPDATE public.listings SET has_reserve = reserve IS NOT NULL, reserve_met = false WHERE id = target_listing;
  PERFORM set_config('revmate.auction_update', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_auction_reserve(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_auction_reserve(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.place_bid(target_listing uuid, bid_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  l public.listings;
  a public.listing_auctions;
  min_bid numeric;
  amount numeric := round(bid_amount);
  previous uuid;
  new_end timestamptz;
  extended boolean := false;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN
    RAISE EXCEPTION 'Log in to bid.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT private.is_known_adult(me) THEN
    RAISE EXCEPTION 'You need to be 18 or over to bid.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (SELECT count(*) FROM public.listing_bids WHERE bidder_id = me AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'That''s a lot of bids. Try again in a bit.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO l FROM public.listings WHERE id = target_listing FOR UPDATE;
  IF NOT FOUND OR l.sale_format <> 'auction' OR l.status <> 'active' THEN
    RAISE EXCEPTION 'This auction isn''t open.' USING ERRCODE = 'check_violation';
  END IF;
  IF l.auction_ends_at <= now() THEN
    RAISE EXCEPTION 'This auction has ended.' USING ERRCODE = 'check_violation';
  END IF;
  IF l.user_id = me THEN
    RAISE EXCEPTION 'You can''t bid on your own listing.' USING ERRCODE = 'check_violation';
  END IF;
  IF private.users_are_blocked(me, l.user_id) THEN
    RAISE EXCEPTION 'You can''t bid on this listing.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  min_bid := CASE WHEN l.current_bid IS NULL THEN l.start_price
    ELSE l.current_bid + private.bid_increment(l.current_bid) END;
  IF amount IS NULL OR amount < min_bid THEN
    RAISE EXCEPTION 'Bid at least £%.', to_char(min_bid, 'FM999,999,990') USING ERRCODE = 'check_violation';
  END IF;
  IF amount > 10000000 THEN
    RAISE EXCEPTION 'That bid is too high.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.listing_auctions (listing_id) VALUES (target_listing) ON CONFLICT (listing_id) DO NOTHING;
  SELECT * INTO a FROM public.listing_auctions WHERE listing_id = target_listing FOR UPDATE;
  previous := a.top_bidder_id;

  INSERT INTO public.listing_bids (listing_id, bidder_id, amount) VALUES (target_listing, me, amount);
  UPDATE public.listing_auctions SET top_bidder_id = me WHERE listing_id = target_listing;

  new_end := l.auction_ends_at;
  IF l.auction_ends_at - now() < interval '2 minutes' THEN
    new_end := now() + interval '2 minutes';
    extended := true;
  END IF;
  PERFORM set_config('revmate.auction_update', 'on', true);
  UPDATE public.listings SET
    current_bid = amount,
    bid_count = bid_count + 1,
    reserve_met = a.reserve_price IS NULL OR amount >= a.reserve_price,
    auction_ends_at = new_end
  WHERE id = target_listing;
  PERFORM set_config('revmate.auction_update', 'off', true);

  -- Outbid alert (shown as coming from the seller, so bidders stay anonymous).
  IF previous IS NOT NULL AND previous <> me AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = previous) THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
    VALUES (previous, l.user_id, 'auction_outbid',
      left('You''ve been outbid on ' || l.title || '. It''s now £' || to_char(amount, 'FM999,999,990') || '.', 500),
      '/marketplace/' || target_listing::text);
  END IF;
  INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
  VALUES (l.user_id, l.user_id, 'auction_bid',
    left('New bid of £' || to_char(amount, 'FM999,999,990') || ' on ' || l.title, 500),
    '/marketplace/' || target_listing::text);

  RETURN jsonb_build_object('current_bid', amount, 'ends_at', new_end, 'extended', extended,
    'reserve_met', a.reserve_price IS NULL OR amount >= a.reserve_price);
END;
$$;
REVOKE ALL ON FUNCTION public.place_bid(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, numeric) TO authenticated;

-- Anonymous bid history: "Bidder 1, 2…" in the order people first bid.
CREATE OR REPLACE FUNCTION public.auction_bids(target_listing uuid)
RETURNS TABLE (amount numeric, created_at timestamptz, bidder_label text, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH firsts AS (
    SELECT bidder_id, row_number() OVER (ORDER BY min(created_at)) AS n
    FROM public.listing_bids WHERE listing_id = target_listing GROUP BY bidder_id
  )
  SELECT b.amount, b.created_at, 'Bidder ' || f.n, b.bidder_id = (SELECT auth.uid())
  FROM public.listing_bids b JOIN firsts f ON f.bidder_id = b.bidder_id
  WHERE b.listing_id = target_listing
  ORDER BY b.amount DESC, b.created_at
  LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.auction_bids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auction_bids(uuid) TO anon, authenticated;

-- Am I winning? (for the bidder's own view)
CREATE OR REPLACE FUNCTION public.my_auction_status(target_listing uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'none'
    WHEN a.winner_id = (SELECT auth.uid()) THEN 'won'
    WHEN a.top_bidder_id = (SELECT auth.uid()) THEN 'winning'
    WHEN EXISTS (SELECT 1 FROM public.listing_bids b WHERE b.listing_id = target_listing AND b.bidder_id = (SELECT auth.uid())) THEN 'outbid'
    ELSE 'none'
  END
  FROM (SELECT 1) one LEFT JOIN public.listing_auctions a ON a.listing_id = target_listing
$$;
REVOKE ALL ON FUNCTION public.my_auction_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_auction_status(uuid) TO anon, authenticated;

-- Closes finished auctions (up to 50 at a time) and tells everyone. Safe to
-- call often and from anywhere: it only acts on auctions that have ended.
CREATE OR REPLACE FUNCTION public.settle_due_auctions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.listings;
  a public.listing_auctions;
  done int := 0;
  price_text text;
BEGIN
  FOR l IN
    SELECT * FROM public.listings
    WHERE sale_format = 'auction' AND auction_settled_at IS NULL AND auction_ends_at <= now()
    ORDER BY auction_ends_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO a FROM public.listing_auctions WHERE listing_id = l.id;
    price_text := '£' || to_char(coalesce(l.current_bid, 0), 'FM999,999,990');
    PERFORM set_config('revmate.auction_update', 'on', true);
    UPDATE public.listings SET auction_settled_at = now() WHERE id = l.id;
    PERFORM set_config('revmate.auction_update', 'off', true);

    IF l.bid_count > 0 AND a.top_bidder_id IS NOT NULL AND l.reserve_met THEN
      UPDATE public.listing_auctions SET winner_id = a.top_bidder_id WHERE listing_id = l.id;
      IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = a.top_bidder_id) THEN
        INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
        VALUES (a.top_bidder_id, l.user_id, 'auction_won',
          left('You won ' || l.title || ' for ' || price_text || '! Message the seller to arrange payment and collection.', 500),
          '/marketplace/' || l.id::text);
        INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
        VALUES (l.user_id, a.top_bidder_id, 'auction_ended',
          left('Your auction for ' || l.title || ' ended at ' || price_text || '. Message the winner to arrange the sale.', 500),
          '/marketplace/' || l.id::text);
      END IF;
    ELSIF l.bid_count > 0 THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
      VALUES (l.user_id, l.user_id, 'auction_ended',
        left('Your auction for ' || l.title || ' ended at ' || price_text || ' but didn''t reach your reserve. You can still make the top bidder an offer.', 500),
        '/marketplace/' || l.id::text);
      IF a.top_bidder_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = a.top_bidder_id) THEN
        INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
        VALUES (a.top_bidder_id, l.user_id, 'auction_ended',
          left('The auction for ' || l.title || ' ended without reaching the reserve.', 500),
          '/marketplace/' || l.id::text);
      END IF;
    ELSE
      INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
      VALUES (l.user_id, l.user_id, 'auction_ended',
        left('Your auction for ' || l.title || ' ended with no bids. You can relist it.', 500),
        '/marketplace/' || l.id::text);
    END IF;
    done := done + 1;
  END LOOP;
  RETURN done;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_due_auctions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_due_auctions() TO anon, authenticated;

-- Winner and seller can see each other on a settled auction (to message).
CREATE OR REPLACE FUNCTION public.auction_counterparty(target_listing uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.username
  FROM public.listings l
  JOIN public.listing_auctions a ON a.listing_id = l.id
  JOIN public.profiles p ON p.user_id = CASE
    WHEN l.user_id = (SELECT auth.uid()) THEN a.winner_id
    WHEN a.winner_id = (SELECT auth.uid()) THEN l.user_id
  END
  WHERE l.id = target_listing AND l.auction_settled_at IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.auction_counterparty(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_counterparty(uuid) TO authenticated;

COMMIT;
