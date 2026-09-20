-- ENUMS
CREATE TYPE public.car_status AS ENUM ('verified', 'unverified');
CREATE TYPE public.fault_source AS ENUM ('ai', 'owner');
CREATE TYPE public.listing_type AS ENUM ('car', 'part');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CARS
CREATE TABLE public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  generation text NOT NULL,
  year_start int,
  year_end int,
  body_type text,
  engine_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  status public.car_status NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  make_slug text GENERATED ALWAYS AS (lower(replace(make, ' ', '-'))) STORED,
  model_slug text GENERATED ALWAYS AS (lower(replace(model, ' ', '-'))) STORED,
  generation_slug text GENERATED ALWAYS AS (lower(replace(generation, ' ', '-'))) STORED,
  UNIQUE (make, model, generation)
);
GRANT SELECT ON public.cars TO anon;
GRANT SELECT, INSERT ON public.cars TO authenticated;
GRANT ALL ON public.cars TO service_role;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cars are viewable by everyone" ON public.cars FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add cars" ON public.cars FOR INSERT TO authenticated WITH CHECK (true);

-- CAR FAULTS
CREATE TABLE public.car_faults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  typical_cost_low numeric,
  typical_cost_high numeric,
  source public.fault_source NOT NULL DEFAULT 'owner',
  upvotes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX car_faults_car_id_idx ON public.car_faults(car_id);
GRANT SELECT ON public.car_faults TO anon;
GRANT SELECT, INSERT ON public.car_faults TO authenticated;
GRANT ALL ON public.car_faults TO service_role;
ALTER TABLE public.car_faults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faults are viewable by everyone" ON public.car_faults FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add faults" ON public.car_faults FOR INSERT TO authenticated WITH CHECK (true);

-- QUESTIONS
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_car_id_idx ON public.questions(car_id);
GRANT SELECT ON public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Users create own questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own questions" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own questions" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ANSWERS
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX answers_question_id_idx ON public.answers(question_id);
GRANT SELECT ON public.answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers are viewable by everyone" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Users create own answers" ON public.answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own answers" ON public.answers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own answers" ON public.answers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- LISTINGS
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price numeric,
  type public.listing_type NOT NULL DEFAULT 'car',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_car_id_idx ON public.listings(car_id);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings are viewable by everyone" ON public.listings FOR SELECT USING (true);
CREATE POLICY "Users create own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own listings" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SAVED CARS (my garage)
CREATE TABLE public.saved_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, car_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_cars TO authenticated;
GRANT ALL ON public.saved_cars TO service_role;
ALTER TABLE public.saved_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own garage" ON public.saved_cars FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add to own garage" ON public.saved_cars FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove from own garage" ON public.saved_cars FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SEED: UK hot hatches + classic 4x4s
INSERT INTO public.cars (make, model, generation, year_start, year_end, body_type, engine_options, summary, status) VALUES
('Ford', 'Fiesta ST', 'Mk7 (ST180)', 2013, 2017, 'Hatchback', '[{"name":"1.6 EcoBoost","power_bhp":180,"fuel":"Petrol","gearbox":"6-speed manual"}]', 'Sharp-handling three-door hot hatch, a UK favourite for its chassis and value.', 'unverified'),
('Ford', 'Focus ST', 'Mk3 (ST250)', 2012, 2018, 'Hatchback', '[{"name":"2.0 EcoBoost","power_bhp":250,"fuel":"Petrol","gearbox":"6-speed manual"},{"name":"2.0 TDCi","power_bhp":185,"fuel":"Diesel","gearbox":"6-speed manual"}]', 'Five-door family hot hatch with a torquey turbo petrol and a rare diesel ST.', 'unverified'),
('Volkswagen', 'Golf GTI', 'Mk7', 2013, 2020, 'Hatchback', '[{"name":"2.0 TSI","power_bhp":220,"fuel":"Petrol","gearbox":"6-speed manual"},{"name":"2.0 TSI Performance","power_bhp":245,"fuel":"Petrol","gearbox":"DSG"}]', 'The all-rounder benchmark: quick, refined and usable every day.', 'unverified'),
('Renault', 'Clio RS', '197/200 (Mk3)', 2006, 2012, 'Hatchback', '[{"name":"2.0 16v F4R","power_bhp":197,"fuel":"Petrol","gearbox":"6-speed manual"},{"name":"2.0 16v F4R (200)","power_bhp":200,"fuel":"Petrol","gearbox":"6-speed manual"}]', 'Naturally aspirated Renaultsport with cult-status steering and Cup chassis option.', 'unverified'),
('Honda', 'Civic Type R', 'FN2', 2007, 2011, 'Hatchback', '[{"name":"2.0 i-VTEC K20Z4","power_bhp":198,"fuel":"Petrol","gearbox":"6-speed manual"}]', 'High-revving VTEC hatch with a distinctive UK-built body and firm ride.', 'unverified'),
('Vauxhall', 'Astra VXR', 'Mk5 (H)', 2005, 2010, 'Hatchback', '[{"name":"2.0 Turbo Z20LEH","power_bhp":237,"fuel":"Petrol","gearbox":"6-speed manual"}]', 'Big-power, big-value three-door with a torque-steer reputation.', 'unverified'),
('Land Rover', 'Defender', '90/110 Td5', 1998, 2007, 'SUV', '[{"name":"2.5 Td5","power_bhp":122,"fuel":"Diesel","gearbox":"5-speed manual"}]', 'Utilitarian icon, hugely capable off-road and endlessly rebuildable.', 'unverified'),
('Land Rover', 'Discovery', 'Series 1', 1989, 1998, 'SUV', '[{"name":"3.9 V8","power_bhp":180,"fuel":"Petrol","gearbox":"5-speed manual"},{"name":"300 Tdi","power_bhp":111,"fuel":"Diesel","gearbox":"5-speed manual"}]', 'Family-friendly Land Rover with genuine off-road ability and rising values.', 'unverified'),
('Land Rover', 'Range Rover', 'Classic', 1970, 1996, 'SUV', '[{"name":"3.5 V8","power_bhp":135,"fuel":"Petrol","gearbox":"4-speed manual"},{"name":"3.9 V8","power_bhp":182,"fuel":"Petrol","gearbox":"4-speed auto"}]', 'The original luxury 4x4, now a sought-after classic restoration project.', 'unverified'),
('Toyota', 'Land Cruiser', 'J80', 1990, 1997, 'SUV', '[{"name":"4.2 1HD-T Turbo Diesel","power_bhp":165,"fuel":"Diesel","gearbox":"5-speed manual"},{"name":"4.5 1FZ-FE Petrol","power_bhp":212,"fuel":"Petrol","gearbox":"4-speed auto"}]', 'Legendarily durable coil-sprung 4x4 with strong overland following in the UK.', 'unverified'),
('Suzuki', 'Jimny', 'SN413 (Mk2)', 1998, 2018, 'SUV', '[{"name":"1.3 M13A","power_bhp":85,"fuel":"Petrol","gearbox":"5-speed manual"}]', 'Tiny ladder-frame 4x4 with low range, cheap to run and a green-lane favourite.', 'unverified');

-- SEED FAULTS
INSERT INTO public.car_faults (car_id, title, description, typical_cost_low, typical_cost_high, source)
SELECT c.id, f.title, f.description, f.low, f.high, 'ai'::public.fault_source
FROM (VALUES
 ('Fiesta ST','Mk7 (ST180)','Hard/collapsed engine mount','Vibration at idle and clunks under load; uprated mounts are a common fix.',150,400),
 ('Fiesta ST','Mk7 (ST180)','Rear suspension arm bush wear','Knocking from the rear and uneven tyre wear on higher-mileage cars.',200,500),
 ('Fiesta ST','Mk7 (ST180)','Carbon build-up on intake valves','Direct-injection deposits causing rough running; walnut blasting resolves it.',250,450),
 ('Focus ST','Mk3 (ST250)','Degas/coolant hose failure','Known coolant hose and degas bottle issues risking overheating.',150,600),
 ('Focus ST','Mk3 (ST250)','Front tyre and torque-steer wear','Front tyres wear quickly under hard driving; check alignment.',200,600),
 ('Focus ST','Mk3 (ST250)','Turbo actuator/boost leak','Loss of power and fault codes from split boost pipes or actuator faults.',200,900),
 ('Golf GTI','Mk7','Water pump / thermostat housing leak','Common coolant leak from the plastic pump housing.',350,650),
 ('Golf GTI','Mk7','DSG mechatronic/clutch pack wear','Jerky low-speed shifts on DQ381/DQ250 boxes; service intervals matter.',400,1800),
 ('Golf GTI','Mk7','Timing chain tensioner (early cars)','Rattle on start-up on early EA888 units.',600,1400),
 ('Clio RS','197/200 (Mk3)','Dephaser pulley / cam sensor rattle','Diesel-like rattle on cold start from the dephaser pulley.',300,800),
 ('Clio RS','197/200 (Mk3)','Rear subframe and suspension corrosion','UK salt causes corrosion on subframes and rear beam.',200,900),
 ('Clio RS','197/200 (Mk3)','Coil pack and misfire issues','Misfires and limp mode from failing coils and plugs.',100,300),
 ('Civic Type R','FN2','Excessive oil consumption','Some K20Z4 engines use oil between services; monitor level closely.',0,1500),
 ('Civic Type R','FN2','Rear trailing arm bush wear','Vague rear end and MOT advisories from perished bushes.',250,600),
 ('Civic Type R','FN2','Air conditioning condenser corrosion','Front-mounted condenser corrodes and leaks.',250,550),
 ('Astra VXR','Mk5 (H)','Cracked/failing turbo and boost pipes','Boost loss from split pipes or a tired Z20LEH turbo.',300,1800),
 ('Astra VXR','Mk5 (H)','Thermostat housing coolant leak','Plastic housing warps and weeps coolant.',150,400),
 ('Astra VXR','Mk5 (H)','Front tyre and brake wear','Heavy torque steer chews front tyres and discs.',300,800),
 ('Defender','90/110 Td5','Chassis and bulkhead corrosion','Rear crossmember, outriggers and bulkhead footwells rot badly.',500,5000),
 ('Defender','90/110 Td5','Td5 injector harness / oil in loom','Oil wicks up the injector loom causing misfires.',200,600),
 ('Defender','90/110 Td5','Oil leaks from swivel hubs and gearbox','Persistent seal leaks are near-universal.',150,700),
 ('Discovery','Series 1','Structural rust (chassis, boot floor, inner wings)','Extensive corrosion is the main killer of Series 1s.',500,4000),
 ('Discovery','Series 1','300 Tdi timing belt neglect','Belt failure destroys the engine if intervals are missed.',300,700),
 ('Discovery','Series 1','V8 head gasket and overheating','Cooling system neglect leads to gasket failure on the 3.9 V8.',600,1800),
 ('Range Rover','Classic','Chassis and door bottom corrosion','Rust in chassis rails, door skins and tailgate.',800,6000),
 ('Range Rover','Classic','V8 top-hat liner slip / head gasket','Serious engine work if overheating has occurred.',1500,5000),
 ('Range Rover','Classic','Air suspension (late cars) faults','Failed bags and compressor on EAS-equipped models.',400,1500),
 ('Land Cruiser','J80','Front axle birfield joint wear','Clicking on full lock from dry or worn birfields.',400,1200),
 ('Land Cruiser','J80','Rear wheel-arch and sill corrosion','UK cars rot around arches, sills and rear crossmember.',400,2500),
 ('Land Cruiser','J80','1HD-T head gasket / head cracking','High-mileage turbo diesels can suffer head issues.',1200,3500),
 ('Jimny','SN413 (Mk2)','Rear chassis rail and sill rust','Classic MOT failure point on UK Jimnys.',300,1500),
 ('Jimny','SN413 (Mk2)','Front wheel bearing and kingpin wear','Play in the front hubs causing MOT advisories.',150,500),
 ('Jimny','SN413 (Mk2)','Timing chain rattle on M13A','Rattle on start-up from a stretched chain or tensioner.',400,900)
) AS f(model, generation, title, description, low, high)
JOIN public.cars c ON c.model = f.model AND c.generation = f.generation;