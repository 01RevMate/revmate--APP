-- Applied live on 2026-11-22. See drizzle/migrations/0086_hide_unsourced_ai_faults.sql.
DROP POLICY IF EXISTS "Hide unsourced AI faults" ON public.car_faults;
CREATE POLICY "Hide unsourced AI faults" ON public.car_faults
  AS RESTRICTIVE FOR SELECT TO public
  USING (source <> 'ai'::public.fault_source OR source_url IS NOT NULL);
