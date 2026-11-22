-- "Get a fixed-price quote" placement on fault pages (growth foundations, task 7).
--
-- Adds a `faults` placement to Deals (Admin → Money → Deals) and a starter BookMyGarage deal that is
-- SWITCHED OFF and points at BookMyGarage's normal website. Don't switch it on until it carries
-- Jordan's tracking link, or no commission is earned. Anything shown is labelled "Ad" in the app.
--
-- Additive and reversible (0085_fault_quote_deal_slot_down.sql).

DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.affiliate_deals'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%placement%'
  LOOP
    EXECUTE format('ALTER TABLE public.affiliate_deals DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.affiliate_deals ADD CONSTRAINT affiliate_deals_placement_check
  CHECK (placement IN ('essentials', 'ev_chargers', 'fuel', 'marketplace', 'faults'));

INSERT INTO public.affiliate_deals (placement, partner, title, blurb, url, cta, sort_order, active)
SELECT 'faults', 'BookMyGarage', 'Get a fixed-price quote',
  'Compare local garage prices for this kind of repair and book online.',
  'https://www.bookmygarage.com/', 'Get a quote', 10, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.affiliate_deals WHERE placement = 'faults' AND partner = 'BookMyGarage'
);
