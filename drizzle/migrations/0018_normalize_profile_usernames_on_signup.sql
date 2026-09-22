CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    NEW.id,
    CASE
      WHEN COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), NULLIF(split_part(NEW.email, '@', 1), '')) IS NULL THEN '@user'
      ELSE '@' || regexp_replace(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1)), '^@+', '')
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;