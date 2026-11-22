-- Keep unverified AI-generated fault claims in the database for review, but do not
-- expose them through the public Data API or car pages until a source is recorded.
-- This restrictive policy combines with the existing car visibility policy.
DROP POLICY IF EXISTS "Hide unsourced AI faults" ON public.car_faults;
CREATE POLICY "Hide unsourced AI faults" ON public.car_faults
  AS RESTRICTIVE FOR SELECT TO public
  USING (source <> 'ai'::public.fault_source OR source_url IS NOT NULL);
