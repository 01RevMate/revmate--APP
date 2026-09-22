GRANT SELECT ON public.group_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;