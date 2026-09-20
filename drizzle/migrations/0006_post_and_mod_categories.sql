CREATE TYPE public.post_category AS ENUM (
  'discussion', 'diagnostics', 'modifications', 'bodywork', 'maintenance', 'showcase'
);
ALTER TABLE public.posts ADD COLUMN category public.post_category NOT NULL DEFAULT 'discussion';

CREATE TYPE public.mod_category AS ENUM (
  'wheels', 'suspension', 'exhaust', 'intake', 'engine', 'exterior', 'interior', 'lighting', 'audio', 'brakes', 'other'
);
ALTER TABLE public.garage_mods ADD COLUMN category public.mod_category;
