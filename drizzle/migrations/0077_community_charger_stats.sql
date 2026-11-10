CREATE OR REPLACE FUNCTION public.community_charger_stats()
RETURNS TABLE(hosts integer, ev_drivers integer, helped integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.charger_hosts WHERE NOT paused),
    (SELECT count(DISTINCT user_id)::int FROM public.garage_cars WHERE fuel_type = 'electric' AND ownership_status = 'current'),
    (SELECT count(*)::int FROM public.charge_requests WHERE status = 'done');
$$;
REVOKE ALL ON FUNCTION public.community_charger_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_charger_stats() TO anon, authenticated, service_role;