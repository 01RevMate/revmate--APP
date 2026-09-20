CREATE TYPE public.fuel_type AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'other');
CREATE TYPE public.transmission_type AS ENUM ('manual', 'automatic', 'cvt', 'dct', 'other');

ALTER TABLE public.garage_cars ADD COLUMN trim text;
ALTER TABLE public.garage_cars ADD COLUMN engine text;
ALTER TABLE public.garage_cars ADD COLUMN horsepower int;
ALTER TABLE public.garage_cars ADD COLUMN mileage int;
ALTER TABLE public.garage_cars ADD COLUMN color text;
ALTER TABLE public.garage_cars ADD COLUMN fuel_type public.fuel_type;
ALTER TABLE public.garage_cars ADD COLUMN transmission public.transmission_type;
ALTER TABLE public.garage_cars ADD COLUMN bio text;

-- Photo gallery per car (photo_url on garage_cars stays as the "primary"
-- avatar-style photo used everywhere else; this is the fuller gallery)
CREATE TABLE public.garage_car_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX garage_car_photos_garage_car_id_idx ON public.garage_car_photos(garage_car_id);
GRANT SELECT ON public.garage_car_photos TO anon;
GRANT SELECT, INSERT, DELETE ON public.garage_car_photos TO authenticated;
GRANT ALL ON public.garage_car_photos TO service_role;
ALTER TABLE public.garage_car_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Car photos are viewable by everyone" ON public.garage_car_photos FOR SELECT USING (true);
CREATE POLICY "Users add photos to own garage cars" ON public.garage_car_photos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.garage_cars gc WHERE gc.id = garage_car_id AND gc.user_id = auth.uid())
);
CREATE POLICY "Users delete photos on own garage cars" ON public.garage_car_photos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.garage_cars gc WHERE gc.id = garage_car_id AND gc.user_id = auth.uid())
);
