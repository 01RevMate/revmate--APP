CREATE OR REPLACE FUNCTION private.tidy_model_name(raw text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT string_agg(CASE WHEN w ~ '[0-9]' OR length(w) <= 3 THEN upper(w) ELSE initcap(w) END, ' ' ORDER BY n)
  FROM unnest(regexp_split_to_array(btrim(raw), '\s+')) WITH ORDINALITY AS t(w, n)
$$;

CREATE OR REPLACE FUNCTION private.link_post_to_car_page() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE mk text; md text; cid uuid;
BEGIN
  IF NEW.car_id IS NOT NULL OR coalesce(btrim(NEW.tagged_make),'') = '' OR coalesce(btrim(NEW.tagged_model),'') = '' THEN
    RETURN NEW;
  END IF;
  mk := private.canonical_vehicle_make(NEW.tagged_make);
  IF mk IS NULL THEN RETURN NEW; END IF;
  md := private.tidy_model_name(NEW.tagged_model);
  SELECT id INTO cid FROM public.cars
   WHERE make = mk AND lower(model) = lower(md)
   ORDER BY (generation = 'All years') DESC, created_at LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.cars (make, model, generation, status, summary)
    VALUES (mk, md, 'All years', 'unverified',
            'Community page — built automatically from owner posts about the ' || mk || ' ' || md || '.')
    ON CONFLICT (make, model, generation) DO UPDATE SET make = EXCLUDED.make
    RETURNING id INTO cid;
  END IF;
  NEW.car_id := cid;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_link_car_page ON public.posts;
CREATE TRIGGER posts_link_car_page BEFORE INSERT OR UPDATE OF tagged_make, tagged_model ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.link_post_to_car_page();

-- backfill existing tagged posts
UPDATE public.posts SET tagged_model = tagged_model WHERE car_id IS NULL AND tagged_make IS NOT NULL;