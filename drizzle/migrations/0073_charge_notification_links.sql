CREATE OR REPLACE FUNCTION private.charge_notification_link() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.kind IN ('charge_request','charge_update') AND NEW.action_url IS NULL THEN
    NEW.action_url := '/ev-chargers/community';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notifications_charge_link BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.charge_notification_link();