CREATE TABLE public.charger_hosts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'emergency' CHECK (mode IN ('emergency','any')),
  cost text NOT NULL DEFAULT 'free' CHECK (cost IN ('free','paid')),
  price_note text CHECK (char_length(price_note) <= 80),
  connector text NOT NULL DEFAULT 'type2_socket' CHECK (connector IN ('type2_socket','type2_tethered','three_pin')),
  kw numeric NOT NULL DEFAULT 7 CHECK (kw IN (2.3,3.6,7,11,22)),
  fits text NOT NULL DEFAULT 'large' CHECK (fits IN ('small','large','van')),
  notes text CHECK (char_length(notes) <= 300),
  district text NOT NULL CHECK (district ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?$'),
  lat numeric NOT NULL CHECK (lat BETWEEN 49 AND 61),
  lng numeric NOT NULL CHECK (lng BETWEEN -9 AND 3),
  discoverable boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charger_hosts TO authenticated;
GRANT ALL ON public.charger_hosts TO service_role;
ALTER TABLE public.charger_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY charger_host_own_read ON public.charger_hosts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY charger_host_own_insert ON public.charger_hosts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND private.is_active_account(user_id) AND private.age_at_least(user_id, 18));
CREATE POLICY charger_host_own_update ON public.charger_hosts FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY charger_host_own_delete ON public.charger_hosts FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.round_charger_host() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.lat := round(NEW.lat, 2);
  NEW.lng := round(NEW.lng, 2);
  NEW.district := upper(NEW.district);
  NEW.updated_at := now();
  IF NEW.cost = 'free' THEN NEW.price_note := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER charger_hosts_round BEFORE INSERT OR UPDATE ON public.charger_hosts FOR EACH ROW EXECUTE FUNCTION private.round_charger_host();

CREATE TABLE public.charge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  car text NOT NULL CHECK (char_length(car) BETWEEN 1 AND 80),
  connector text NOT NULL CHECK (connector IN ('type2','three_pin','not_sure')),
  range_miles integer CHECK (range_miles BETWEEN 0 AND 600),
  emergency boolean NOT NULL DEFAULT true,
  message text CHECK (char_length(message) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','done','expired','cancelled')),
  shared_location text CHECK (char_length(shared_location) <= 300),
  expires_at timestamptz,
  rating smallint CHECK (rating IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX charge_requests_requester ON public.charge_requests(requester_id, created_at DESC);
CREATE INDEX charge_requests_host ON public.charge_requests(host_id, created_at DESC);
REVOKE ALL ON public.charge_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, requester_id, host_id, car, connector, range_miles, emergency, message, status, expires_at, rating, created_at, updated_at) ON public.charge_requests TO authenticated;
GRANT ALL ON public.charge_requests TO service_role;
ALTER TABLE public.charge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY charge_request_party_read ON public.charge_requests FOR SELECT TO authenticated USING ((requester_id = (SELECT auth.uid()) OR host_id = (SELECT auth.uid())) AND NOT private.users_are_blocked(requester_id, host_id));

CREATE TABLE public.charger_searches (
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX charger_searches_user ON public.charger_searches(user_id, created_at DESC);
REVOKE ALL ON public.charger_searches FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.charger_searches TO service_role;
ALTER TABLE public.charger_searches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY['comment','like','join_request','membership','friend_request','friend_accepted','car_like','answer','post_review','app_update','message','car_follow','profile_follow','mention','comment_reply','comment_like','meet_rsvp','meet_reminder','repost','spotted','car_of_week','weekly_recap','rank_up','challenge','price_drop','mot_reminder','tax_reminder','issue_resolved','resolve_prompt','search_alert','offer','offer_update','review_request','order_update','auction_bid','auction_outbid','auction_won','auction_ended','badge','charge_request','charge_update']));

CREATE OR REPLACE FUNCTION private.expire_charge_requests() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.charge_requests SET status = 'expired', shared_location = NULL, updated_at = now()
  WHERE status = 'approved' AND expires_at <= now();
  UPDATE public.charge_requests SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND created_at <= now() - interval '6 hours';
  UPDATE public.charge_requests SET shared_location = NULL
  WHERE shared_location IS NOT NULL AND status <> 'approved';
$$;

CREATE OR REPLACE FUNCTION public.nearby_charger_hosts(p_lat double precision, p_lng double precision, p_emergency boolean)
RETURNS TABLE(host_id uuid, username text, avatar_url text, band text, band_order integer, connector text, kw numeric, fits text, cost text, price_note text, mode text, notes text, thumbs_up bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid(); la double precision := round(p_lat::numeric, 2); ln double precision := round(p_lng::numeric, 2);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to find a charger'; END IF;
  IF NOT private.is_active_account(me) OR NOT private.age_at_least(me, 18) THEN RAISE EXCEPTION 'Community chargers are for members aged 18 and over'; END IF;
  IF (SELECT count(*) FROM public.charger_searches s WHERE s.user_id = me AND s.created_at > now() - interval '1 hour') >= 15 THEN
    RAISE EXCEPTION 'Too many searches — try again in a little while';
  END IF;
  INSERT INTO public.charger_searches(user_id) VALUES (me);
  RETURN QUERY
  WITH d AS (
    SELECT h.*, 3958.8 * 2 * asin(sqrt(power(sin(radians(h.lat::float8 - la) / 2), 2) + cos(radians(la)) * cos(radians(h.lat::float8)) * power(sin(radians(h.lng::float8 - ln) / 2), 2))) AS miles
    FROM public.charger_hosts h
    WHERE h.user_id <> me AND NOT h.paused
      AND (h.discoverable OR p_emergency)
      AND (p_emergency OR h.mode = 'any')
      AND private.is_active_account(h.user_id) AND private.age_at_least(h.user_id, 18)
      AND NOT private.users_are_blocked(me, h.user_id)
  )
  SELECT d.user_id, p.username, p.avatar_url,
    CASE WHEN d.miles < 2 THEN 'Under 2 mi' WHEN d.miles < 5 THEN '2–5 mi' WHEN d.miles < 15 THEN '5–15 mi' ELSE '15–30 mi' END,
    CASE WHEN d.miles < 2 THEN 1 WHEN d.miles < 5 THEN 2 WHEN d.miles < 15 THEN 3 ELSE 4 END,
    d.connector, d.kw, d.fits, d.cost, d.price_note, d.mode, d.notes,
    (SELECT count(*) FROM public.charge_requests r WHERE r.host_id = d.user_id AND r.rating = 1)
  FROM d JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.miles < 30
  ORDER BY 5, random()
  LIMIT 25;
END $$;

CREATE OR REPLACE FUNCTION public.request_charge(p_host uuid, p_car text, p_connector text, p_range integer, p_emergency boolean, p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid(); h public.charger_hosts; rid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF me = p_host THEN RAISE EXCEPTION 'You can''t request your own charger'; END IF;
  IF NOT private.is_active_account(me) OR NOT private.age_at_least(me, 18) THEN RAISE EXCEPTION 'Community chargers are for members aged 18 and over'; END IF;
  SELECT * INTO h FROM public.charger_hosts WHERE user_id = p_host;
  IF h.user_id IS NULL OR h.paused OR private.users_are_blocked(me, p_host) THEN RAISE EXCEPTION 'This host isn''t available right now'; END IF;
  IF NOT p_emergency AND h.mode <> 'any' THEN RAISE EXCEPTION 'This host only helps in emergencies'; END IF;
  IF (SELECT count(*) FROM public.charge_requests WHERE requester_id = me AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'You''ve sent a few requests already — wait for a reply or try again soon';
  END IF;
  IF EXISTS (SELECT 1 FROM public.charge_requests WHERE requester_id = me AND host_id = p_host AND status IN ('pending','approved')) THEN
    RAISE EXCEPTION 'You already have an open request with this host';
  END IF;
  INSERT INTO public.charge_requests(requester_id, host_id, car, connector, range_miles, emergency, message)
  VALUES (me, p_host, left(trim(p_car), 80), p_connector, p_range, p_emergency, nullif(left(trim(coalesce(p_message,'')), 500), ''))
  RETURNING id INTO rid;
  INSERT INTO public.notifications(user_id, actor_id, kind, message)
  VALUES (p_host, me, 'charge_request', CASE WHEN p_emergency THEN 'needs an emergency charge' ELSE 'asked to use your charger' END);
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.respond_charge_request(p_request uuid, p_action text, p_location text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid(); r public.charge_requests;
BEGIN
  PERFORM private.expire_charge_requests();
  SELECT * INTO r FROM public.charge_requests WHERE id = p_request;
  IF r.id IS NULL OR me IS NULL OR (me <> r.host_id AND me <> r.requester_id) THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF p_action = 'approve' THEN
    IF me <> r.host_id OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request can''t be approved'; END IF;
    IF coalesce(char_length(trim(p_location)), 0) < 3 THEN RAISE EXCEPTION 'Add where to meet, such as an address or a what3words'; END IF;
    UPDATE public.charge_requests SET status = 'approved', shared_location = left(trim(p_location), 300), expires_at = now() + interval '4 hours', updated_at = now() WHERE id = r.id;
    INSERT INTO public.notifications(user_id, actor_id, kind, message) VALUES (r.requester_id, me, 'charge_update', 'said yes to your charge request');
  ELSIF p_action = 'decline' THEN
    IF me <> r.host_id OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request can''t be declined'; END IF;
    UPDATE public.charge_requests SET status = 'declined', updated_at = now() WHERE id = r.id;
    INSERT INTO public.notifications(user_id, actor_id, kind, message) VALUES (r.requester_id, me, 'charge_update', 'can''t help this time');
  ELSIF p_action = 'cancel' THEN
    IF me <> r.requester_id OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request can''t be cancelled'; END IF;
    UPDATE public.charge_requests SET status = 'cancelled', updated_at = now() WHERE id = r.id;
  ELSIF p_action = 'done' THEN
    IF r.status NOT IN ('approved','pending') THEN RAISE EXCEPTION 'This request is already closed'; END IF;
    UPDATE public.charge_requests SET status = 'done', shared_location = NULL, updated_at = now() WHERE id = r.id;
  ELSE RAISE EXCEPTION 'Unknown action';
  END IF;
  RETURN p_action;
END $$;

CREATE OR REPLACE FUNCTION public.rate_charge_host(p_request uuid, p_rating integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_rating NOT IN (-1, 1) THEN RAISE EXCEPTION 'Pick thumbs up or down'; END IF;
  UPDATE public.charge_requests SET rating = p_rating, updated_at = now()
  WHERE id = p_request AND requester_id = auth.uid() AND status IN ('done','expired') AND expires_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'You can rate a host after an approved charge'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.my_charge_requests()
RETURNS TABLE(id uuid, role text, other_id uuid, other_username text, other_avatar text, car text, connector text, range_miles integer, emergency boolean, message text, status text, shared_location text, expires_at timestamptz, rating smallint, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  PERFORM private.expire_charge_requests();
  RETURN QUERY
  SELECT r.id, CASE WHEN r.host_id = me THEN 'host' ELSE 'driver' END,
    p.user_id, p.username, p.avatar_url, r.car, r.connector, r.range_miles, r.emergency, r.message, r.status,
    CASE WHEN r.status = 'approved' AND r.expires_at > now() THEN r.shared_location END,
    r.expires_at, r.rating, r.created_at
  FROM public.charge_requests r
  JOIN public.profiles p ON p.user_id = CASE WHEN r.host_id = me THEN r.requester_id ELSE r.host_id END
  WHERE (r.host_id = me OR r.requester_id = me) AND NOT private.users_are_blocked(r.requester_id, r.host_id)
  ORDER BY r.created_at DESC LIMIT 50;
END $$;

REVOKE ALL ON FUNCTION public.nearby_charger_hosts(double precision, double precision, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_charge(uuid, text, text, integer, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_charge_request(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rate_charge_host(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_charge_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_charger_hosts(double precision, double precision, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_charge(uuid, text, text, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_charge_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_charge_host(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_charge_requests() TO authenticated;
REVOKE ALL ON FUNCTION private.expire_charge_requests() FROM PUBLIC, anon, authenticated;