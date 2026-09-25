CREATE OR REPLACE FUNCTION public.can_view_admin_log(_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT public.is_global_admin() OR (_unit IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_unit_permissions p JOIN public.units u ON u.id=p.unit_id
    WHERE p.user_id=auth.uid() AND p.unit_id=_unit AND p.active AND u.active
      AND p.role='ADMIN_UNIDADE' AND p.validation_status='VALIDADO'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_admin_log(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_admin_log(uuid) TO authenticated;

DROP POLICY IF EXISTS f2b_iso_select ON public.admin_logs;
CREATE POLICY f2b_iso_select ON public.admin_logs AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_view_admin_log(unit_id));
CREATE POLICY logs_select_unit_admin ON public.admin_logs FOR SELECT TO authenticated USING (public.can_view_admin_log(unit_id));

CREATE POLICY f2b_iso_select ON public.unit_audit_log AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_view_admin_log(unit_id));
CREATE POLICY logs_select_unit_admin ON public.unit_audit_log FOR SELECT TO authenticated USING (public.can_view_admin_log(unit_id));