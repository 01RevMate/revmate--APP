-- RevMate Store: car products sold by RevMate and delivered to the door,
-- either drop-shipped by a supplier or sent by a UK partner. Card payment
-- goes through Stripe Checkout (the store-checkout edge function); the
-- stripe-webhook function marks orders paid. Admins manage products,
-- supplier details (never shown to members) and order fulfilment.
--
-- Also adds the notification kinds used by the store, auctions (0068) and
-- badges (0069). Needs 0064_money.sql. Additive and safe to re-run.

BEGIN;

-- ---------- Notification kinds ----------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment', 'like', 'join_request', 'membership', 'friend_request',
    'friend_accepted', 'car_like', 'answer', 'post_review', 'app_update',
    'message', 'car_follow', 'profile_follow',
    'mention', 'comment_reply', 'comment_like', 'meet_rsvp', 'meet_reminder',
    'repost', 'spotted',
    'car_of_week', 'weekly_recap', 'rank_up', 'challenge',
    'price_drop',
    'mot_reminder', 'tax_reminder', 'issue_resolved', 'resolve_prompt',
    'search_alert', 'offer', 'offer_update', 'review_request',
    'order_update', 'auction_bid', 'auction_outbid', 'auction_won', 'auction_ended', 'badge'
  )
);

-- ---------- Products ----------
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  brand text NOT NULL DEFAULT '' CHECK (char_length(brand) <= 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  images text[] NOT NULL DEFAULT '{}' CHECK (cardinality(images) <= 8),
  category text NOT NULL CHECK (category IN ('parts', 'detailing', 'fresheners', 'styling', 'wheels_tyres', 'tech', 'performance', 'merch')),
  price_pence int NOT NULL CHECK (price_pence BETWEEN 50 AND 1000000),
  was_price_pence int CHECK (was_price_pence IS NULL OR was_price_pence BETWEEN 50 AND 1000000),
  delivery_pence int NOT NULL DEFAULT 0 CHECK (delivery_pence BETWEEN 0 AND 10000),
  delivery_estimate text NOT NULL DEFAULT '3–5 working days' CHECK (char_length(delivery_estimate) <= 40),
  fulfilment text NOT NULL DEFAULT 'dropship' CHECK (fulfilment IN ('dropship', 'partner', 'revmate')),
  -- NULL = no stock limit (typical for drop-shipping).
  stock int CHECK (stock IS NULL OR stock >= 0),
  -- Makes it fits; empty = universal.
  fits_makes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  sold_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_products_active_idx ON public.store_products (active, category, sort_order);

-- Supplier details: admins only (cost price, where to order it from).
CREATE TABLE IF NOT EXISTS public.store_suppliers (
  product_id uuid PRIMARY KEY REFERENCES public.store_products(id) ON DELETE CASCADE,
  supplier text NOT NULL DEFAULT '' CHECK (char_length(supplier) <= 120),
  supplier_url text CHECK (supplier_url IS NULL OR (supplier_url LIKE 'https://%' AND char_length(supplier_url) <= 1000)),
  supplier_sku text NOT NULL DEFAULT '' CHECK (char_length(supplier_sku) <= 120),
  cost_pence int CHECK (cost_pence IS NULL OR cost_pence >= 0),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000)
);

-- ---------- Orders ----------
CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'paid', 'ordered', 'shipped', 'delivered', 'cancelled', 'refunded')),
  -- Snapshot at checkout: [{product_id, title, qty, price_pence}]
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  subtotal_pence int NOT NULL CHECK (subtotal_pence >= 0),
  delivery_pence int NOT NULL DEFAULT 0 CHECK (delivery_pence >= 0),
  total_pence int NOT NULL CHECK (total_pence >= 0),
  shipping_name text,
  shipping_address jsonb,
  email text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  tracking_carrier text CHECK (tracking_carrier IS NULL OR char_length(tracking_carrier) <= 60),
  tracking_number text CHECK (tracking_number IS NULL OR char_length(tracking_number) <= 80),
  tracking_url text CHECK (tracking_url IS NULL OR (tracking_url LIKE 'https://%' AND char_length(tracking_url) <= 1000)),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 2000),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_orders_user_idx ON public.store_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status_idx ON public.store_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_intent_idx ON public.store_orders (stripe_payment_intent);

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_products, public.store_suppliers, public.store_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_products TO anon, authenticated;
GRANT INSERT (slug, title, brand, description, images, category, price_pence, was_price_pence,
    delivery_pence, delivery_estimate, fulfilment, stock, fits_makes, active, sort_order),
  UPDATE (title, brand, description, images, category, price_pence, was_price_pence,
    delivery_pence, delivery_estimate, fulfilment, stock, fits_makes, active, sort_order),
  DELETE ON public.store_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_suppliers TO authenticated;
GRANT SELECT ON public.store_orders TO authenticated;
GRANT UPDATE (status, tracking_carrier, tracking_number, tracking_url, admin_note) ON public.store_orders TO authenticated;
GRANT ALL ON public.store_products, public.store_suppliers, public.store_orders TO service_role;

DROP POLICY IF EXISTS store_products_read ON public.store_products;
CREATE POLICY store_products_read ON public.store_products FOR SELECT
  USING (active OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS store_products_admin ON public.store_products;
CREATE POLICY store_products_admin ON public.store_products FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS store_suppliers_admin ON public.store_suppliers;
CREATE POLICY store_suppliers_admin ON public.store_suppliers FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS store_orders_read ON public.store_orders;
CREATE POLICY store_orders_read ON public.store_orders FOR SELECT TO authenticated USING (
  (user_id = (SELECT auth.uid()) AND status <> 'pending_payment')
  OR private.is_revmate_admin((SELECT auth.uid()))
);
DROP POLICY IF EXISTS store_orders_admin_update ON public.store_orders;
CREATE POLICY store_orders_admin_update ON public.store_orders FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- Tell the customer when their order moves on.
CREATE OR REPLACE FUNCTION private.notify_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  msg text;
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id) THEN
    msg := CASE NEW.status
      WHEN 'paid' THEN 'Thanks! Your RevMate Store order is confirmed.'
      WHEN 'ordered' THEN 'Your order is being prepared.'
      WHEN 'shipped' THEN 'Your order is on its way' || CASE WHEN NEW.tracking_number IS NOT NULL THEN ' (tracking ' || NEW.tracking_number || ')' ELSE '' END || '.'
      WHEN 'delivered' THEN 'Your order has been delivered. Enjoy!'
      WHEN 'cancelled' THEN 'Your order was cancelled.'
      WHEN 'refunded' THEN 'Your order has been refunded.'
    END;
    IF msg IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
      VALUES (NEW.user_id, NEW.user_id, 'order_update', msg, '/orders');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_order_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS store_orders_notify ON public.store_orders;
CREATE TRIGGER store_orders_notify BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION private.notify_order_update();

INSERT INTO public.app_settings (key, value) VALUES
  ('store_enabled', 'false'),
  ('store_free_delivery_over', '5000')
ON CONFLICT (key) DO NOTHING;

-- ---------- Checkout (service role only, called by store-checkout) ----------

-- Prices a basket from the database and creates a pending order. Returns the
-- order with its line items, or raises a friendly error.
CREATE OR REPLACE FUNCTION public.store_create_order(p_user uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  prod public.store_products;
  qty int;
  lines jsonb := '[]'::jsonb;
  subtotal int := 0;
  delivery int := 0;
  free_over int;
  order_id uuid;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'Your basket is empty.' USING ERRCODE = 'check_violation';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    qty := coalesce((item ->> 'qty')::int, 0);
    IF qty < 1 OR qty > 10 THEN
      RAISE EXCEPTION 'You can buy 1 to 10 of each item.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO prod FROM public.store_products WHERE id = (item ->> 'product_id')::uuid AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Something in your basket is no longer available.' USING ERRCODE = 'check_violation';
    END IF;
    IF prod.stock IS NOT NULL AND prod.stock < qty THEN
      RAISE EXCEPTION '% is out of stock.', prod.title USING ERRCODE = 'check_violation';
    END IF;
    lines := lines || jsonb_build_object('product_id', prod.id, 'title', prod.title, 'qty', qty, 'price_pence', prod.price_pence);
    subtotal := subtotal + prod.price_pence * qty;
    delivery := greatest(delivery, prod.delivery_pence);
  END LOOP;
  SELECT coalesce(nullif(value, '')::int, 0) INTO free_over FROM public.app_settings WHERE key = 'store_free_delivery_over';
  IF coalesce(free_over, 0) > 0 AND subtotal >= free_over THEN
    delivery := 0;
  END IF;
  INSERT INTO public.store_orders (user_id, items, subtotal_pence, delivery_pence, total_pence)
  VALUES (p_user, lines, subtotal, delivery, subtotal + delivery)
  RETURNING id INTO order_id;
  RETURN jsonb_build_object('order_id', order_id, 'items', lines, 'subtotal_pence', subtotal,
    'delivery_pence', delivery, 'total_pence', subtotal + delivery);
END;
$$;

CREATE OR REPLACE FUNCTION public.store_attach_session(p_order uuid, p_session text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.store_orders SET stripe_session_id = p_session
  WHERE id = p_order AND status = 'pending_payment'
$$;

-- Called by the webhook when Checkout completes. Safe to repeat.
CREATE OR REPLACE FUNCTION public.store_mark_paid(
  p_order uuid, p_session text, p_intent text, p_amount int,
  p_name text, p_address jsonb, p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o public.store_orders;
  line jsonb;
BEGIN
  SELECT * INTO o FROM public.store_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending_payment' THEN
    RETURN false;
  END IF;
  IF o.stripe_session_id IS NOT NULL AND o.stripe_session_id <> p_session THEN
    RETURN false;
  END IF;
  UPDATE public.store_orders SET
    status = 'paid',
    stripe_session_id = p_session,
    stripe_payment_intent = p_intent,
    total_pence = coalesce(p_amount, total_pence),
    shipping_name = left(p_name, 120),
    shipping_address = p_address,
    email = left(p_email, 200),
    paid_at = now()
  WHERE id = p_order;
  FOR line IN SELECT * FROM jsonb_array_elements(o.items) LOOP
    UPDATE public.store_products SET
      sold_count = sold_count + (line ->> 'qty')::int,
      stock = CASE WHEN stock IS NULL THEN NULL ELSE greatest(0, stock - (line ->> 'qty')::int) END
    WHERE id = (line ->> 'product_id')::uuid;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_mark_refunded(p_intent text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.store_orders SET status = 'refunded'
  WHERE stripe_payment_intent = p_intent AND status NOT IN ('refunded', 'pending_payment')
$$;

REVOKE ALL ON FUNCTION public.store_create_order(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_attach_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_mark_paid(uuid, text, text, int, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_mark_refunded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_create_order(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_attach_session(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_mark_paid(uuid, text, text, int, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_mark_refunded(text) TO service_role;

COMMIT;
