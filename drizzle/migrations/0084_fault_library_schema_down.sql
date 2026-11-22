-- Rollback for 0084_fault_library_schema.sql. Never deletes faults.
-- The new columns are kept (dropping them would lose the sources and check dates that were added);
-- only the constraint is removed. A Postgres enum value can't be removed once added, so `editorial`
-- stays in the type; it is harmless when unused. Editorial faults already imported are left in place.
ALTER TABLE public.car_faults DROP CONSTRAINT IF EXISTS car_faults_cost_source_url_https;
