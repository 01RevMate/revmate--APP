-- Rollback for 0082_business_discovery.sql.
-- Removes the search function and its readiness check so the directory goes back to its earlier
-- search. The serves_nationwide column and every business's value for it are kept.
DROP FUNCTION IF EXISTS public.business_discovery_ready();
DROP FUNCTION IF EXISTS public.search_businesses(text, text[], text, text, numeric, boolean, boolean, text, integer, integer, text[]);
DELETE FROM public.schema_features WHERE name = 'business_discovery';
