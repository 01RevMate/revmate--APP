-- Restores the previous public read behaviour without deleting any fault rows.
DROP POLICY IF EXISTS "Hide unsourced AI faults" ON public.car_faults;
