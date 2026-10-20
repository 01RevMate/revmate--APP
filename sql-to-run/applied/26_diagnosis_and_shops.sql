-- Step 26: AI diagnosis limits + Shops directory.
-- Copy of drizzle/migrations/0066_diagnosis_and_shops.sql. Run after step 25. Safe to re-run.

-- AI diagnosis limits and the Shops directory.
--
--   * ai_usage: how many AI diagnosis steps each member used per day, so the
--     AI bill can't run away. Checked and counted by ai_take_credit(), which
--     only the diagnose edge function (service role) can call. An admin
--     switches AI on and sets the daily caps in app_settings.
--   * shops / shop_products: brands and small makers selling car stuff (parts,
--     detailing, air fresheners, styling, merch…). Members apply to list a
--     shop; an admin approves it. Products link out to the shop's own site.
--
-- Needs 0064_money.sql (app_settings). Additive and safe to re-run.

BEGIN;

-- ---------- AI diagnosis ----------

CREATE TABLE IF NOT EXISTS public.ai_usage (
  day date NOT NULL DEFAULT current_date,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calls int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_usage TO service_role;

INSERT INTO public.app_settings (key, value) VALUES
  ('ai_diagnosis_enabled', 'false'),
  ('ai_daily_cap', '300'),
  ('ai_user_daily_cap', '15')
ON CONFLICT (key) DO NOTHING;

-- 'ok' (and counts one call), or why not: 'off', 'user_limit', 'global_limit'.
CREATE OR REPLACE FUNCTION public.ai_take_credit(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  enabled text;
  global_cap int;
  user_cap int;
  used_total int;
  used_mine int;
BEGIN
  SELECT value INTO enabled FROM public.app_settings WHERE key = 'ai_diagnosis_enabled';
  IF coalesce(enabled, 'false') <> 'true' THEN
    RETURN 'off';
  END IF;
  SELECT coalesce(nullif(value, '')::int, 300) INTO global_cap FROM public.app_settings WHERE key = 'ai_daily_cap';
  SELECT coalesce(nullif(value, '')::int, 15) INTO user_cap FROM public.app_settings WHERE key = 'ai_user_daily_cap';
  -- One at a time, so two requests can't both take the last credit.
  PERFORM pg_advisory_xact_lock(hashtext('revmate_ai_usage'));
  SELECT coalesce(sum(calls), 0) INTO used_total FROM public.ai_usage WHERE day = current_date;
  IF used_total >= coalesce(global_cap, 300) THEN
    RETURN 'global_limit';
  END IF;
  SELECT coalesce(calls, 0) INTO used_mine FROM public.ai_usage WHERE day = current_date AND user_id = p_user;
  IF coalesce(used_mine, 0) >= coalesce(user_cap, 15) THEN
    RETURN 'user_limit';
  END IF;
  INSERT INTO public.ai_usage (day, user_id, calls) VALUES (current_date, p_user, 1)
  ON CONFLICT (day, user_id) DO UPDATE SET calls = public.ai_usage.calls + 1;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.ai_take_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_take_credit(uuid) TO service_role;

-- Admin: AI steps used today and in the last 30 days.
CREATE OR REPLACE FUNCTION public.admin_ai_usage()
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
    'today', (SELECT coalesce(sum(calls), 0) FROM public.ai_usage WHERE day = current_date),
    'people_today', (SELECT count(*) FROM public.ai_usage WHERE day = current_date),
    'last_30d', (SELECT coalesce(sum(calls), 0) FROM public.ai_usage WHERE day > current_date - 30)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_ai_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage() TO authenticated;

-- ---------- Shops ----------

CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$'),
  tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1500),
  logo_url text CHECK (logo_url IS NULL OR (logo_url LIKE 'https://%' AND char_length(logo_url) <= 1000)),
  website text NOT NULL CHECK (website LIKE 'https://%' AND char_length(website) <= 1000),
  categories text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(categories) BETWEEN 1 AND 4
    AND categories <@ ARRAY['parts', 'detailing', 'fresheners', 'styling', 'wheels_tyres', 'tech', 'performance', 'merch']::text[]
  ),
  made_in_uk boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  promoted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shops_active_idx ON public.shops (status, created_at DESC);
CREATE INDEX IF NOT EXISTS shops_owner_idx ON public.shops (owner_user_id);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  price_pence int CHECK (price_pence IS NULL OR price_pence BETWEEN 0 AND 10000000),
  image_url text CHECK (image_url IS NULL OR (image_url LIKE 'https://%' AND char_length(image_url) <= 1000)),
  url text NOT NULL CHECK (url LIKE 'https://%' AND char_length(url) <= 1000),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_products_shop_idx ON public.shop_products (shop_id, sort_order);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shops, public.shop_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shops, public.shop_products TO anon, authenticated;
GRANT INSERT (name, slug, tagline, description, logo_url, website, categories, made_in_uk),
  UPDATE (name, tagline, description, logo_url, website, categories, made_in_uk, status, promoted_until),
  DELETE ON public.shops TO authenticated;
GRANT INSERT (shop_id, title, price_pence, image_url, url, active, sort_order),
  UPDATE (title, price_pence, image_url, url, active, sort_order),
  DELETE ON public.shop_products TO authenticated;
GRANT ALL ON public.shops, public.shop_products TO service_role;

DROP POLICY IF EXISTS shops_read ON public.shops;
CREATE POLICY shops_read ON public.shops FOR SELECT USING (
  status = 'active'
  OR owner_user_id = (SELECT auth.uid())
  OR private.is_revmate_admin((SELECT auth.uid()))
);
DROP POLICY IF EXISTS shops_insert ON public.shops;
CREATE POLICY shops_insert ON public.shops FOR INSERT TO authenticated WITH CHECK (
  owner_user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid()))
);
DROP POLICY IF EXISTS shops_update ON public.shops;
CREATE POLICY shops_update ON public.shops FOR UPDATE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS shops_delete ON public.shops;
CREATE POLICY shops_delete ON public.shops FOR DELETE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));

-- Owners can't approve themselves or buy promotion by editing the row, and
-- each member can run at most three shops.
CREATE OR REPLACE FUNCTION private.guard_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin boolean := private.is_revmate_admin((SELECT auth.uid()));
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT admin THEN
      NEW.status := 'pending';
      NEW.promoted_until := NULL;
      IF (SELECT count(*) FROM public.shops WHERE owner_user_id = NEW.owner_user_id) >= 3 THEN
        RAISE EXCEPTION 'You can list up to three shops.' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  ELSIF NOT admin THEN
    NEW.status := OLD.status;
    NEW.promoted_until := OLD.promoted_until;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_shop() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_shop ON public.shops;
CREATE TRIGGER guard_shop BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION private.guard_shop();

CREATE OR REPLACE FUNCTION private.owns_shop(p_shop uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = p_shop
      AND (s.owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())))
  )
$$;
REVOKE ALL ON FUNCTION private.owns_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_shop(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS shop_products_read ON public.shop_products;
CREATE POLICY shop_products_read ON public.shop_products FOR SELECT USING (
  (active AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.status = 'active'))
  OR private.owns_shop(shop_id)
);
DROP POLICY IF EXISTS shop_products_write ON public.shop_products;
CREATE POLICY shop_products_write ON public.shop_products FOR ALL TO authenticated
  USING (private.owns_shop(shop_id)) WITH CHECK (private.owns_shop(shop_id));

CREATE OR REPLACE FUNCTION private.limit_shop_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.shop_products WHERE shop_id = NEW.shop_id) >= 24 THEN
    RAISE EXCEPTION 'A shop can show up to 24 products.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.limit_shop_products() FROM PUBLIC;
DROP TRIGGER IF EXISTS limit_shop_products ON public.shop_products;
CREATE TRIGGER limit_shop_products BEFORE INSERT ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION private.limit_shop_products();

-- Click counting only; no record of who clicked.
CREATE OR REPLACE FUNCTION public.record_shop_click(product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.shop_products p SET clicks = clicks + 1
  WHERE p.id = product_id AND p.active
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = p.shop_id AND s.status = 'active')
$$;
REVOKE ALL ON FUNCTION public.record_shop_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_shop_click(uuid) TO anon, authenticated;

COMMIT;
