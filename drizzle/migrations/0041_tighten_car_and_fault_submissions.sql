DROP POLICY IF EXISTS "Authenticated users can add cars" ON public.cars;
CREATE POLICY "Authenticated users can add cars"
ON public.cars FOR INSERT TO authenticated
WITH CHECK (
  private.is_active_account((SELECT auth.uid()))
  AND (status = 'unverified' OR public.is_admin((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated users can add faults" ON public.car_faults;
CREATE POLICY "Authenticated users can add faults"
ON public.car_faults FOR INSERT TO authenticated
WITH CHECK (
  private.is_active_account((SELECT auth.uid()))
  AND ((source = 'owner' AND upvotes = 0) OR public.is_admin((SELECT auth.uid())))
);