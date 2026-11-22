-- Rollback for 0085_fault_quote_deal_slot.sql. Removes only the starter deal if it was never switched
-- on or edited into a live deal; any deals an admin has since created for the faults placement are
-- kept (they move to "essentials" so the stricter constraint holds).
DELETE FROM public.affiliate_deals
WHERE placement = 'faults' AND partner = 'BookMyGarage' AND active = false AND clicks = 0
  AND url = 'https://www.bookmygarage.com/';
UPDATE public.affiliate_deals SET placement = 'essentials' WHERE placement = 'faults';
ALTER TABLE public.affiliate_deals DROP CONSTRAINT IF EXISTS affiliate_deals_placement_check;
ALTER TABLE public.affiliate_deals ADD CONSTRAINT affiliate_deals_placement_check
  CHECK (placement IN ('essentials', 'ev_chargers', 'fuel', 'marketplace'));
