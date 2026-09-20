-- Official UK passenger-car catalogue for cascading make/model/derivative/fuel selectors.
-- Contains public sector information licensed under the Open Government Licence v3.0.
-- Source: Department for Transport and Driver and Vehicle Licensing Agency,
-- vehicle licensing statistics, 2026 Q1.

CREATE TABLE public.vehicle_makes (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_models (
  id text PRIMARY KEY,
  make_id text NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  source_generic_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make_id, source_generic_model)
);

CREATE TABLE public.vehicle_derivatives (
  id text PRIMARY KEY,
  model_id text NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, name)
);

CREATE TABLE public.vehicle_powertrains (
  id text PRIMARY KEY,
  derivative_id text NOT NULL REFERENCES public.vehicle_derivatives(id) ON DELETE CASCADE,
  fuel_type_code text NOT NULL,
  fuel_type text NOT NULL,
  engine_sizes_cc integer[] NOT NULL DEFAULT '{}',
  engine_size_bands text[] NOT NULL DEFAULT '{}',
  licensed_count integer NOT NULL DEFAULT 0,
  sorn_count integer NOT NULL DEFAULT 0,
  current_vehicle_count integer NOT NULL DEFAULT 0,
  source_period text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (derivative_id, fuel_type_code)
);

-- Curated RevMate generation pages remain in `cars`. This optional mapping lets
-- an editor connect one page to the relevant official family or derivative.
CREATE TABLE public.car_catalog_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  model_id text NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  derivative_id text REFERENCES public.vehicle_derivatives(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (car_id, model_id, derivative_id)
);

ALTER TABLE public.garage_cars
  ADD COLUMN catalog_make_id text REFERENCES public.vehicle_makes(id) ON DELETE SET NULL,
  ADD COLUMN catalog_model_id text REFERENCES public.vehicle_models(id) ON DELETE SET NULL,
  ADD COLUMN catalog_derivative_id text REFERENCES public.vehicle_derivatives(id) ON DELETE SET NULL,
  ADD COLUMN catalog_powertrain_id text REFERENCES public.vehicle_powertrains(id) ON DELETE SET NULL;

CREATE INDEX vehicle_models_make_id_idx ON public.vehicle_models(make_id);
CREATE INDEX vehicle_models_make_slug_idx ON public.vehicle_models(make_id, slug);
CREATE INDEX vehicle_derivatives_model_id_idx ON public.vehicle_derivatives(model_id);
CREATE INDEX vehicle_derivatives_model_slug_idx ON public.vehicle_derivatives(model_id, slug);
CREATE INDEX vehicle_powertrains_derivative_id_idx ON public.vehicle_powertrains(derivative_id);
CREATE INDEX vehicle_powertrains_fuel_type_idx ON public.vehicle_powertrains(fuel_type_code);
CREATE INDEX vehicle_powertrains_popularity_idx ON public.vehicle_powertrains(current_vehicle_count DESC);
CREATE INDEX car_catalog_links_model_id_idx ON public.car_catalog_links(model_id);
CREATE INDEX garage_cars_catalog_model_id_idx ON public.garage_cars(catalog_model_id);

GRANT SELECT ON public.vehicle_makes, public.vehicle_models, public.vehicle_derivatives,
  public.vehicle_powertrains, public.car_catalog_links TO anon, authenticated;
GRANT ALL ON public.vehicle_makes, public.vehicle_models, public.vehicle_derivatives,
  public.vehicle_powertrains, public.car_catalog_links TO service_role;

ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_derivatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_powertrains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_catalog_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicle makes are public"
  ON public.vehicle_makes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vehicle models are public"
  ON public.vehicle_models FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vehicle derivatives are public"
  ON public.vehicle_derivatives FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vehicle powertrains are public"
  ON public.vehicle_powertrains FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Car catalogue links are public"
  ON public.car_catalog_links FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.vehicle_makes IS
  'DfT/DVLA UK vehicle licensing statistics, 2026 Q1, OGL v3.0, passenger cars only.';
COMMENT ON COLUMN public.vehicle_derivatives.name IS
  'Official detailed Model value. It often contains trim/derivative text but is not a guaranteed manufacturer trim taxonomy.';
