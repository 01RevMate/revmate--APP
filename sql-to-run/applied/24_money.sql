-- Step 24: money (paid extras, Plus, Business Pro, deals, shop link, sponsors).
-- Copy of drizzle/migrations/0064_money.sql. Run after step 23. Safe to re-run.

-- Money: everything RevMate needs to earn without charging for anything
-- social. Paid listing features, RevMate Plus (optional supporter plan),
-- Business Pro for garages and traders, affiliate "Deals" on the practical
-- pages, a merch shop link and sponsored weekly challenges.
--
-- Card payments go through Stripe Checkout. The app never sees card
-- details: the create-checkout edge function opens a Stripe page and the
-- stripe-webhook edge function records what was paid for by calling the
-- service-role-only functions at the bottom of this file.
--
-- Nothing is for sale until an admin switches payments on in Admin → Money
-- (app_settings.payments_enabled). Additive and safe to re-run.

BEGIN;

-- ---------- Settings (admin-editable, readable by everyone) ----------

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY CHECK (key ~ '^[a-z_]{1,40}$'),
  value text NOT NULL DEFAULT '' CHECK (char_length(value) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS app_settings_admin_insert ON public.app_settings;
CREATE POLICY app_settings_admin_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_admin_update ON public.app_settings FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

INSERT INTO public.app_settings (key, value) VALUES
  ('payments_enabled', 'false'),
  ('shop_url', ''),
  ('shop_label', 'RevMate shop')
ON CONFLICT (key) DO NOTHING;

-- ---------- What can be bought ----------
-- Prices live here so an admin can change them without a code change.
-- The edge function always charges what this table says, never what the
-- app sends.

CREATE TABLE IF NOT EXISTS public.paid_products (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9_]{1,40}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  kind text NOT NULL CHECK (kind IN ('listing_feature', 'plus', 'business_pro')),
  billing text NOT NULL CHECK (billing IN ('one_off', 'monthly')),
  price_pence int NOT NULL CHECK (price_pence BETWEEN 50 AND 100000),
  -- Founding members pay this instead, when set.
  founding_price_pence int CHECK (founding_price_pence IS NULL OR founding_price_pence BETWEEN 50 AND 100000),
  feature_days int CHECK (feature_days IS NULL OR feature_days BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  CHECK ((kind = 'listing_feature') = (feature_days IS NOT NULL)),
  CHECK ((kind = 'listing_feature') = (billing = 'one_off'))
);
ALTER TABLE public.paid_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paid_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.paid_products TO anon, authenticated;
GRANT UPDATE (name, description, price_pence, founding_price_pence, active, sort_order)
  ON public.paid_products TO authenticated;
GRANT ALL ON public.paid_products TO service_role;

DROP POLICY IF EXISTS paid_products_read ON public.paid_products;
CREATE POLICY paid_products_read ON public.paid_products FOR SELECT
  USING (active OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS paid_products_admin_update ON public.paid_products;
CREATE POLICY paid_products_admin_update ON public.paid_products FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

INSERT INTO public.paid_products
  (code, name, description, kind, billing, price_pence, founding_price_pence, feature_days, sort_order)
VALUES
  ('feature_3d', 'Feature for 3 days', 'Top of Buy & Sell with a Featured label for 3 days.',
    'listing_feature', 'one_off', 299, NULL, 3, 10),
  ('feature_7d', 'Feature for 7 days', 'Top of Buy & Sell with a Featured label for a week.',
    'listing_feature', 'one_off', 499, NULL, 7, 20),
  ('plus_monthly', 'RevMate Plus', 'Support RevMate, get the Plus badge and no ads or deals anywhere.',
    'plus', 'monthly', 299, 149, NULL, 30),
  ('business_pro_monthly', 'Business Pro', 'Shown first in Find a mechanic with a Pro badge.',
    'business_pro', 'monthly', 1999, NULL, NULL, 40)
ON CONFLICT (code) DO NOTHING;

-- ---------- Records (written only by the Stripe webhook) ----------

CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kept (as NULL) when an account is deleted, for the accounts.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_code text NOT NULL,
  target_id uuid,
  amount_pence int NOT NULL CHECK (amount_pence >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  stripe_ref text NOT NULL UNIQUE,
  stripe_payment_intent text,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS payments_intent_idx ON public.payments (stripe_payment_intent);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_code text NOT NULL,
  target_id uuid,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_customers, public.payments, public.subscriptions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payments, public.subscriptions TO authenticated;
GRANT ALL ON public.billing_customers, public.payments, public.subscriptions TO service_role;

DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS subscriptions_read ON public.subscriptions;
CREATE POLICY subscriptions_read ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));

-- ---------- Plus and Business Pro ----------

CREATE OR REPLACE FUNCTION public.is_plus_member(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.paid_products p ON p.code = s.product_code
    WHERE s.user_id = uid AND p.kind = 'plus'
      AND s.status IN ('active', 'trialing', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now() - interval '3 days')
  )
$$;
REVOKE ALL ON FUNCTION public.is_plus_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_plus_member(uuid) TO anon, authenticated;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS promoted_until timestamptz;

-- ---------- Deals (affiliate links on the practical pages only) ----------

CREATE TABLE IF NOT EXISTS public.affiliate_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement text NOT NULL CHECK (placement IN ('essentials', 'ev_chargers', 'fuel', 'marketplace')),
  partner text NOT NULL CHECK (char_length(partner) BETWEEN 1 AND 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  blurb text NOT NULL DEFAULT '' CHECK (char_length(blurb) <= 160),
  url text NOT NULL CHECK (url LIKE 'https://%' AND char_length(url) <= 1000),
  cta text NOT NULL DEFAULT 'View deal' CHECK (char_length(cta) BETWEEN 1 AND 30),
  image_url text CHECK (image_url IS NULL OR (image_url LIKE 'https://%' AND char_length(image_url) <= 1000)),
  active boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_deals_placement_idx
  ON public.affiliate_deals (placement, sort_order) WHERE active;

ALTER TABLE public.affiliate_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_deals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.affiliate_deals TO anon, authenticated;
GRANT INSERT (placement, partner, title, blurb, url, cta, image_url, active, sort_order),
  UPDATE (placement, partner, title, blurb, url, cta, image_url, active, sort_order),
  DELETE ON public.affiliate_deals TO authenticated;
GRANT ALL ON public.affiliate_deals TO service_role;

DROP POLICY IF EXISTS affiliate_deals_read ON public.affiliate_deals;
CREATE POLICY affiliate_deals_read ON public.affiliate_deals FOR SELECT
  USING (active OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS affiliate_deals_admin_write ON public.affiliate_deals;
CREATE POLICY affiliate_deals_admin_write ON public.affiliate_deals FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- Click counting only; no record of who clicked.
CREATE OR REPLACE FUNCTION public.record_deal_click(deal_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.affiliate_deals SET clicks = clicks + 1 WHERE id = deal_id AND active
$$;
REVOKE ALL ON FUNCTION public.record_deal_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_deal_click(uuid) TO anon, authenticated;

-- Starter deals, switched off. Swap each link for your affiliate link once
-- the programme approves you, then switch it on in Admin → Money → Deals.
INSERT INTO public.affiliate_deals (placement, partner, title, blurb, url, cta, sort_order)
SELECT * FROM (VALUES
  ('essentials', 'Blackcircles', 'Tyres fitted near you', 'Pick tyres online and get them fitted at a local garage.', 'https://www.blackcircles.com/', 'Find tyres', 10),
  ('essentials', 'BookMyGarage', 'Book your MOT or service', 'Compare local garage prices and book online.', 'https://www.bookmygarage.com/', 'Compare prices', 20),
  ('essentials', 'Euro Car Parts', 'Parts and car care', 'Parts, oils and detailing kit with click & collect.', 'https://www.eurocarparts.com/', 'Shop parts', 30),
  ('ev_chargers', 'Home charger', 'Get a home charger fitted', 'Charging at home is usually far cheaper than public chargers.', 'https://www.ohme-ev.com/', 'See chargers', 10),
  ('fuel', 'Breakdown cover', 'Breakdown cover', 'Compare UK breakdown cover before you need it.', 'https://www.theaa.com/breakdown-cover', 'Compare cover', 10)
) AS v(placement, partner, title, blurb, url, cta, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_deals);

-- ---------- Sponsored challenges ----------
-- Sponsors are arranged and invoiced outside the app; admins add the name.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS sponsor_name text CHECK (sponsor_name IS NULL OR char_length(sponsor_name) BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS sponsor_url text CHECK (sponsor_url IS NULL OR (sponsor_url LIKE 'https://%' AND char_length(sponsor_url) <= 1000)),
  ADD COLUMN IF NOT EXISTS prize text CHECK (prize IS NULL OR char_length(prize) BETWEEN 1 AND 120);

-- ---------- Webhook-only writers (service role) ----------

CREATE OR REPLACE FUNCTION public.billing_save_customer(p_user uuid, p_customer text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.billing_customers (user_id, stripe_customer_id)
  VALUES (p_user, p_customer)
  ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id
$$;

-- One-off payment (listing features) or a subscription invoice. stripe_ref
-- is the Checkout session or invoice id, so a repeated webhook is a no-op.
CREATE OR REPLACE FUNCTION public.billing_record_payment(
  p_user uuid, p_product text, p_target uuid, p_amount int, p_currency text,
  p_ref text, p_intent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted uuid;
  days int;
BEGIN
  INSERT INTO public.payments
    (user_id, product_code, target_id, amount_pence, currency, stripe_ref, stripe_payment_intent)
  VALUES (p_user, p_product, p_target, p_amount, coalesce(p_currency, 'gbp'), p_ref, p_intent)
  ON CONFLICT (stripe_ref) DO NOTHING
  RETURNING id INTO inserted;
  IF inserted IS NULL THEN
    RETURN false;
  END IF;

  SELECT feature_days INTO days FROM public.paid_products
    WHERE code = p_product AND kind = 'listing_feature';
  IF days IS NOT NULL AND p_target IS NOT NULL THEN
    -- Extends an existing feature rather than cutting it short. Uses the
    -- counter flag so the listing guard lets the change through.
    PERFORM set_config('revmate.counter_update', 'on', true);
    UPDATE public.listings
      SET featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => days)
      WHERE id = p_target AND user_id = p_user;
    PERFORM set_config('revmate.counter_update', 'off', true);
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_upsert_subscription(
  p_subscription text, p_user uuid, p_product text, p_target uuid, p_status text,
  p_period_end timestamptz, p_cancel_at_end boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  live boolean := p_status IN ('active', 'trialing', 'past_due');
BEGIN
  INSERT INTO public.subscriptions
    (stripe_subscription_id, user_id, product_code, target_id, status, current_period_end, cancel_at_period_end)
  VALUES (p_subscription, p_user, p_product, p_target, p_status, p_period_end, coalesce(p_cancel_at_end, false))
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    status = EXCLUDED.status,
    current_period_end = coalesce(EXCLUDED.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = now();

  IF p_target IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.paid_products WHERE code = p_product AND kind = 'business_pro'
  ) THEN
    UPDATE public.businesses
      SET promoted_until = CASE WHEN live THEN coalesce(p_period_end, now() + interval '31 days') END
      WHERE id = p_target AND owner_user_id = p_user;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_mark_refunded(p_intent text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.payments SET status = 'refunded' WHERE stripe_payment_intent = p_intent
$$;

REVOKE ALL ON FUNCTION public.billing_save_customer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_record_payment(uuid, text, uuid, int, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_upsert_subscription(text, uuid, text, uuid, text, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_mark_refunded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_save_customer(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_record_payment(uuid, text, uuid, int, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_upsert_subscription(text, uuid, text, uuid, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_mark_refunded(text) TO service_role;

-- ---------- Admin overview ----------

CREATE OR REPLACE FUNCTION public.admin_money_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_revmate_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'revenue_month_pence', (SELECT coalesce(sum(amount_pence), 0) FROM public.payments
      WHERE status = 'paid' AND created_at >= date_trunc('month', now())),
    'revenue_30d_pence', (SELECT coalesce(sum(amount_pence), 0) FROM public.payments
      WHERE status = 'paid' AND created_at > now() - interval '30 days'),
    'revenue_all_pence', (SELECT coalesce(sum(amount_pence), 0) FROM public.payments WHERE status = 'paid'),
    'plus_members', (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s
      JOIN public.paid_products p ON p.code = s.product_code
      WHERE p.kind = 'plus' AND s.status IN ('active', 'trialing', 'past_due')),
    'business_pro', (SELECT count(*) FROM public.businesses WHERE promoted_until > now()),
    'featured_now', (SELECT count(*) FROM public.listings WHERE featured_until > now()),
    'deal_clicks', (SELECT coalesce(sum(clicks), 0) FROM public.affiliate_deals)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_money_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_money_stats() TO authenticated;

COMMIT;
