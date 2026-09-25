
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.row_access(_unit uuid, _area uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT CASE WHEN _area IS NOT NULL THEN public.user_has_area_access(_area)
              WHEN _unit IS NOT NULL THEN public.user_has_unit_access(_unit)
              ELSE false END
$$;

-- Restrictive policies (AND with existing permissive ones)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['auditorias','nao_conformidades','melhorias','gemba_visitas','alertas_processo','auditorias_log'] LOOP
    EXECUTE format('CREATE POLICY "f2b_iso_select" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id))', t);
    EXECUTE format('CREATE POLICY "f2b_iso_insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.row_access(unit_id, area_id))', t);
    EXECUTE format('CREATE POLICY "f2b_iso_update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.row_access(unit_id, area_id)) WITH CHECK (public.row_access(unit_id, area_id))', t);
    EXECUTE format('CREATE POLICY "f2b_iso_delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.row_access(unit_id, area_id))', t);
  END LOOP;
END $$;

CREATE POLICY "f2b_iso_select" ON public.areas AS RESTRICTIVE FOR SELECT TO authenticated USING (unit_id IS NOT NULL AND public.user_has_unit_access(unit_id));
CREATE POLICY "f2b_iso_write" ON public.areas AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_unit_admin(unit_id)) WITH CHECK (unit_id IS NOT NULL AND public.is_unit_admin(unit_id));
-- the ALL policy also applies to SELECT; keep reads for non-admins:
DROP POLICY "f2b_iso_write" ON public.areas;
CREATE POLICY "f2b_iso_insert" ON public.areas AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (unit_id IS NOT NULL AND public.is_unit_admin(unit_id));
CREATE POLICY "f2b_iso_update" ON public.areas AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_unit_admin(unit_id)) WITH CHECK (unit_id IS NOT NULL AND public.is_unit_admin(unit_id));
CREATE POLICY "f2b_iso_delete" ON public.areas AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_unit_admin(unit_id));

CREATE POLICY "f2b_iso_select" ON public.nc_historico AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nao_conformidades n WHERE n.id = nc_id AND public.row_access(n.unit_id, n.area_id)));
CREATE POLICY "f2b_iso_insert" ON public.nc_historico AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.nao_conformidades n WHERE n.id = nc_id AND public.row_access(n.unit_id, n.area_id)));

CREATE POLICY "f2b_iso_select" ON public.respostas_auditoria AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auditorias a WHERE a.id = auditoria_id AND public.row_access(a.unit_id, a.area_id)));
CREATE POLICY "f2b_iso_insert" ON public.respostas_auditoria AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.auditorias a WHERE a.id = auditoria_id AND public.row_access(a.unit_id, a.area_id)));
CREATE POLICY "f2b_iso_update" ON public.respostas_auditoria AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auditorias a WHERE a.id = auditoria_id AND public.row_access(a.unit_id, a.area_id)));
CREATE POLICY "f2b_iso_delete" ON public.respostas_auditoria AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auditorias a WHERE a.id = auditoria_id AND public.row_access(a.unit_id, a.area_id)));

CREATE POLICY "f2b_iso_select" ON public.admin_logs AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_global_admin() OR (unit_id IS NOT NULL AND public.is_unit_admin(unit_id)));

-- units: only authorized units visible
CREATE POLICY "f2b_units_select" ON public.units FOR SELECT TO authenticated USING (public.user_has_unit_access(id));
CREATE POLICY "f2b_iso_select" ON public.units AS RESTRICTIVE FOR SELECT TO authenticated USING (public.user_has_unit_access(id));

-- Evidence ownership resolution
CREATE OR REPLACE FUNCTION public.evidence_owner(_path text)
RETURNS TABLE(unit_id uuid, area_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  WITH s AS (SELECT split_part(_path,'/',1) AS seg)
  SELECT a.unit_id, a.area_id FROM public.auditorias a, s WHERE a.id::text = s.seg OR _path = ANY(a.fotos)
  UNION ALL SELECT n.unit_id, n.area_id FROM public.nao_conformidades n, s
    WHERE n.id::text = s.seg OR n.foto_url = _path OR _path = ANY(n.foto_urls) OR _path = ANY(n.documento_urls)
  UNION ALL SELECT m.unit_id, m.area_id FROM public.melhorias m, s WHERE m.id::text = s.seg OR _path = ANY(m.foto_urls)
  UNION ALL SELECT g.unit_id, g.area_id FROM public.gemba_visitas g, s WHERE g.id::text = s.seg OR _path = ANY(g.foto_antes_urls) OR _path = ANY(g.foto_depois_urls)
  UNION ALL SELECT x.unit_id, x.area_id FROM public.alertas_processo x, s WHERE x.id::text = s.seg OR _path = ANY(x.foto_urls)
  UNION ALL SELECT a.unit_id, a.area_id FROM public.respostas_auditoria r JOIN public.auditorias a ON a.id = r.auditoria_id WHERE r.foto_url = _path
$$;

CREATE OR REPLACE FUNCTION public.evidence_read_allowed(_path text, _owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.evidence_owner(_path)) THEN
      EXISTS (SELECT 1 FROM public.evidence_owner(_path) o WHERE public.row_access(o.unit_id, o.area_id))
    ELSE (_owner = auth.uid()) OR public.is_global_admin()
      OR EXISTS (SELECT 1 FROM public.user_unit_permissions p WHERE p.user_id = auth.uid() AND p.active AND public.is_unit_admin(p.unit_id))
  END
$$;

CREATE OR REPLACE FUNCTION public.evidence_write_allowed(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_unit_permissions p JOIN public.units u ON u.id=p.unit_id
                 WHERE p.user_id = auth.uid() AND p.active AND u.active)
    AND NOT EXISTS (SELECT 1 FROM public.evidence_owner(_path) o WHERE NOT public.row_access(o.unit_id, o.area_id))
$$;

CREATE POLICY "f2b_ev_select" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'audit-photos' OR public.evidence_read_allowed(name, owner));
CREATE POLICY "f2b_ev_insert" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'audit-photos' OR public.evidence_write_allowed(name));
CREATE POLICY "f2b_ev_update" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'audit-photos' OR (public.evidence_write_allowed(name) AND public.evidence_read_allowed(name, owner)));
CREATE POLICY "f2b_ev_delete" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'audit-photos' OR (public.evidence_write_allowed(name) AND public.evidence_read_allowed(name, owner)));

-- Blocked-attempt logging
CREATE OR REPLACE FUNCTION public.log_access_denied(_entity text, _entity_id uuid, _detail text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_unit uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT unit_id INTO v_unit FROM (
    SELECT unit_id FROM public.auditorias WHERE id=_entity_id
    UNION ALL SELECT unit_id FROM public.nao_conformidades WHERE id=_entity_id
    UNION ALL SELECT unit_id FROM public.melhorias WHERE id=_entity_id
    UNION ALL SELECT unit_id FROM public.gemba_visitas WHERE id=_entity_id
    UNION ALL SELECT unit_id FROM public.alertas_processo WHERE id=_entity_id) x LIMIT 1;
  INSERT INTO public.unit_audit_log(unit_id, user_id, action, entity, entity_id, justification)
  VALUES (v_unit, auth.uid(), 'ACESSO_NEGADO', left(_entity,60), _entity_id, left(coalesce(_detail,''),300));
END $$;
REVOKE ALL ON FUNCTION public.log_access_denied(text,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text,uuid,text) TO authenticated;
