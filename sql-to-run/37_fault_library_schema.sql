-- Fault library schema (growth foundations, task 6).
--
-- * `editorial` is a new fault source: entries RevMate staff write, in their own words, from a
--   cited source (see data/fault-library/README.md).
-- * `cost_source_url`: where a cost range comes from. The app only shows a cost range when this is
--   set, so unsourced (estimated) costs are never published.
-- * `last_checked`: the date the source was read.
--
-- Additive and reversible (0084_fault_library_schema_down.sql). Existing faults are untouched: the
-- 11 AI-sourced entries keep their text and costs in the database, but the app now hides their cost
-- ranges until a cost source is added.

ALTER TYPE public.fault_source ADD VALUE IF NOT EXISTS 'editorial';

ALTER TABLE public.car_faults
  ADD COLUMN IF NOT EXISTS cost_source_url text,
  ADD COLUMN IF NOT EXISTS last_checked date;

ALTER TABLE public.car_faults DROP CONSTRAINT IF EXISTS car_faults_cost_source_url_https;
ALTER TABLE public.car_faults ADD CONSTRAINT car_faults_cost_source_url_https
  CHECK (cost_source_url IS NULL OR (cost_source_url LIKE 'https://%' AND char_length(cost_source_url) <= 1000));
