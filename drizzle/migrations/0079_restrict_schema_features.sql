DROP POLICY IF EXISTS schema_features_read ON public.schema_features;
REVOKE SELECT ON public.schema_features FROM anon;
CREATE POLICY schema_features_read ON public.schema_features FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));