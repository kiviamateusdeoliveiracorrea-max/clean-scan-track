REVOKE EXECUTE ON FUNCTION public.profile_visible(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auditor_units(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.profile_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditor_units(uuid) TO authenticated;