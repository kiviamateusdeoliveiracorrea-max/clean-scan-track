REVOKE EXECUTE ON FUNCTION public.set_unit_from_area() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_global_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_unit_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_area_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_unit_role(uuid, public.unit_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_unit_admin(uuid) FROM PUBLIC, anon;