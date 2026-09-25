CREATE OR REPLACE FUNCTION public.profile_visible(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT _target = auth.uid()
    OR public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_unit_permissions t JOIN public.units u ON u.id = t.unit_id
      WHERE t.user_id = _target AND t.active AND u.active
        AND (
          public.is_unit_admin(t.unit_id)
          OR (public.user_has_unit_access(t.unit_id) AND (
                NOT EXISTS (SELECT 1 FROM public.user_area_permissions c
                            WHERE c.user_id = auth.uid() AND c.unit_id = t.unit_id AND c.active)
                OR EXISTS (
                  SELECT 1 FROM (
                    SELECT ap.area_id FROM public.user_area_permissions ap
                      WHERE ap.user_id = _target AND ap.unit_id = t.unit_id AND ap.active
                    UNION SELECT p.area_id FROM public.profiles p WHERE p.id = _target AND p.area_id IS NOT NULL
                  ) ta WHERE public.user_has_area_access(ta.area_id))
          ))
        ))
    OR EXISTS (SELECT 1 FROM public.nao_conformidades n
               WHERE _target IN (n.responsavel_nc_id, n.responsavel_acao_id, n.aprovador_id, n.aprovado_por, n.updated_by, n.excluida_por)
                 AND public.row_access(n.unit_id, n.area_id))
    OR EXISTS (SELECT 1 FROM public.melhorias m WHERE m.responsavel_id = _target AND public.row_access(m.unit_id, m.area_id))
    OR EXISTS (SELECT 1 FROM public.gemba_visitas g WHERE g.responsavel_id = _target AND public.row_access(g.unit_id, g.area_id))
    OR EXISTS (SELECT 1 FROM public.auditorias a WHERE a.cancelada_por = _target AND public.row_access(a.unit_id, a.area_id))
$$;

CREATE POLICY "sec6_profiles_select" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.profile_visible(id));

-- Auditores: unidade(s) do auditor = unidades do perfil com o mesmo e-mail + unidades das auditorias feitas por ele
CREATE OR REPLACE FUNCTION public.auditor_units(_auditor uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT p.unit_id FROM public.auditores a
    JOIN public.profiles pr ON lower(trim(pr.email)) = lower(trim(a.email))
    JOIN public.user_unit_permissions p ON p.user_id = pr.id AND p.active
   WHERE a.id = _auditor
  UNION SELECT x.unit_id FROM public.auditorias x WHERE x.auditor_id = _auditor
$$;

CREATE POLICY "sec11_auditores_select" ON public.auditores AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR NOT EXISTS (SELECT 1 FROM public.auditor_units(id))
    OR EXISTS (SELECT 1 FROM public.auditor_units(id) u(unit_id) WHERE public.user_has_unit_access(u.unit_id))
  );

REVOKE SELECT ON public.auditores FROM authenticated, anon;
GRANT SELECT (id, nome, created_at) ON public.auditores TO authenticated;

CREATE OR REPLACE FUNCTION public.list_auditores()
RETURNS TABLE(id uuid, nome text, area_nome text, email text, matricula text, can_see_contact boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  WITH vis AS (
    SELECT a.* FROM public.auditores a
    WHERE auth.uid() IS NOT NULL AND (
      public.is_global_admin()
      OR NOT EXISTS (SELECT 1 FROM public.auditor_units(a.id))
      OR EXISTS (SELECT 1 FROM public.auditor_units(a.id) u(unit_id) WHERE public.user_has_unit_access(u.unit_id)))
  ), c AS (
    SELECT v.*,
      public.is_global_admin() OR EXISTS (
        SELECT 1 FROM public.auditor_units(v.id) u(unit_id) WHERE public.user_has_unit_role(u.unit_id, 'ADMIN_UNIDADE')) AS ok
    FROM vis v
  )
  SELECT c.id, c.nome,
    (SELECT ar.nome FROM public.profiles pr JOIN public.areas ar ON ar.id = pr.area_id
      WHERE lower(trim(pr.email)) = lower(trim(c.email)) LIMIT 1),
    CASE WHEN c.ok THEN c.email END, CASE WHEN c.ok THEN c.matricula END, c.ok
  FROM c ORDER BY c.nome
$$;
REVOKE EXECUTE ON FUNCTION public.list_auditores() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_auditores() TO authenticated;