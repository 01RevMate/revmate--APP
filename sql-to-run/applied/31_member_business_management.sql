ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_contact_name_length CHECK (contact_name IS NULL OR char_length(contact_name) <= 100);
DROP POLICY IF EXISTS businesses_owner_insert ON public.businesses;
CREATE POLICY businesses_owner_insert ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())) AND verified = false AND status = 'active' AND promoted_until IS NULL);
CREATE OR REPLACE FUNCTION private.guard_business_owner_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR private.is_revmate_admin((SELECT auth.uid())) THEN RETURN NEW; END IF;
  NEW.id := OLD.id;
  NEW.verified := OLD.verified;
  NEW.status := OLD.status;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.promoted_until := OLD.promoted_until;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_business_owner_edit() FROM PUBLIC, anon, authenticated;
COMMENT ON COLUMN public.businesses.contact_name IS 'Optional public business contact name, provided by the business owner.';