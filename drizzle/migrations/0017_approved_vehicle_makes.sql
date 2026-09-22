CREATE TABLE IF NOT EXISTS public.approved_vehicle_makes (
  name text PRIMARY KEY,
  sort_order integer NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.approved_vehicle_make_aliases (
  alias_key text PRIMARY KEY,
  make_name text NOT NULL REFERENCES public.approved_vehicle_makes(name) ON DELETE CASCADE
);

INSERT INTO public.approved_vehicle_makes(name, sort_order) VALUES
  ('Abarth',1),('AION',2),('Alfa Romeo',3),('Alpine',4),('Audi',5),
  ('BMW',6),('BYD',7),('Changan',8),('Citroen',9),('CUPRA',10),
  ('Dacia',11),('David Brown',12),('DS AUTOMOBILES',13),('Fiat',14),('Fisker',15),
  ('Ford',16),('Geely',17),('Genesis',18),('GMC',19),('GWM',20),
  ('Honda',21),('Hummer',22),('Hyundai',23),('Isuzu',24),('JAECOO',25),
  ('Jaguar',26),('Jeep',27),('KGM',28),('Kia',29),('Land Rover',30),
  ('Leapmotor',31),('LEVC',32),('Lexus',33),('Lotus',34),('Maserati',35),
  ('MAXUS',36),('Mazda',37),('Mercedes-Benz',38),('MEV',39),('MG',40),
  ('Micro',41),('MINI',42),('MOKE',43),('Nissan',44),('OMODA',45),
  ('Peugeot',46),('Polestar',47),('Porsche',48),('Renault',49),('Rimac',50),
  ('Rivian',51),('Rolls-Royce',52),('SEAT',53),('Skoda',54),('Skywell',55),
  ('Smart',56),('SsangYong',57),('Subaru',58),('Suzuki',59),('Tesla',60),
  ('Toyota',61),('Vauxhall',62),('Volkswagen',63),('Volvo',64)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.approved_vehicle_make_aliases(alias_key, make_name)
SELECT lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')), name
FROM public.approved_vehicle_makes
ON CONFLICT (alias_key) DO NOTHING;

INSERT INTO public.approved_vehicle_make_aliases(alias_key, make_name) VALUES
  ('ds', 'DS AUTOMOBILES'),
  ('greatwall', 'GWM'),
  ('mercedes', 'Mercedes-Benz')
ON CONFLICT (alias_key) DO NOTHING;

GRANT SELECT ON public.approved_vehicle_makes, public.approved_vehicle_make_aliases
  TO anon, authenticated;
GRANT ALL ON public.approved_vehicle_makes, public.approved_vehicle_make_aliases
  TO service_role;

ALTER TABLE public.approved_vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_vehicle_make_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approved_makes_read ON public.approved_vehicle_makes;
CREATE POLICY approved_makes_read
  ON public.approved_vehicle_makes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS approved_make_aliases_read ON public.approved_vehicle_make_aliases;
CREATE POLICY approved_make_aliases_read
  ON public.approved_vehicle_make_aliases FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION private.canonical_vehicle_make(candidate text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT aliases.make_name
  FROM public.approved_vehicle_make_aliases aliases
  WHERE aliases.alias_key = lower(regexp_replace(btrim(candidate), '[^a-zA-Z0-9]+', '', 'g'))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.enforce_approved_garage_make()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE canonical text;
BEGIN
  canonical := private.canonical_vehicle_make(NEW.make);
  IF canonical IS NULL THEN
    RAISE EXCEPTION 'Unsupported vehicle make: %', NEW.make USING ERRCODE = '23514';
  END IF;
  NEW.make := canonical;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_approved_car_make()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE canonical text;
BEGIN
  canonical := private.canonical_vehicle_make(NEW.make);
  IF canonical IS NULL THEN
    RAISE EXCEPTION 'Unsupported vehicle make: %', NEW.make USING ERRCODE = '23514';
  END IF;
  NEW.make := canonical;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_approved_group_make()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE canonical text;
BEGIN
  IF NEW.make_name IS NULL THEN RETURN NEW; END IF;
  canonical := private.canonical_vehicle_make(NEW.make_name);
  IF canonical IS NULL THEN
    RAISE EXCEPTION 'Unsupported vehicle make: %', NEW.make_name USING ERRCODE = '23514';
  END IF;
  NEW.make_name := canonical;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garage_cars_approved_make ON public.garage_cars;
CREATE TRIGGER garage_cars_approved_make
  BEFORE INSERT OR UPDATE OF make ON public.garage_cars
  FOR EACH ROW EXECUTE FUNCTION private.enforce_approved_garage_make();

DROP TRIGGER IF EXISTS cars_approved_make ON public.cars;
CREATE TRIGGER cars_approved_make
  BEFORE INSERT OR UPDATE OF make ON public.cars
  FOR EACH ROW EXECUTE FUNCTION private.enforce_approved_car_make();

DROP TRIGGER IF EXISTS community_groups_approved_make ON public.community_groups;
CREATE TRIGGER community_groups_approved_make
  BEFORE INSERT OR UPDATE OF make_name ON public.community_groups
  FOR EACH ROW EXECUTE FUNCTION private.enforce_approved_group_make();

DROP POLICY IF EXISTS "Vehicle makes are public" ON public.vehicle_makes;
CREATE POLICY "Vehicle makes are public"
  ON public.vehicle_makes FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.approved_vehicle_make_aliases aliases
      WHERE aliases.alias_key =
        lower(regexp_replace(btrim(vehicle_makes.name), '[^a-zA-Z0-9]+', '', 'g'))
    )
  );

COMMENT ON TABLE public.approved_vehicle_makes IS
  'The 64 vehicle makes approved for RevMate product use.';