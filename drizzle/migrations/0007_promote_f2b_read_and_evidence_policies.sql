-- Applied atomically by the migration runner; no separate transaction statements.
DROP POLICY IF EXISTS "areas read auth" ON public.areas;
CREATE POLICY "areas read auth" ON public.areas FOR SELECT TO authenticated USING (unit_id IS NOT NULL AND public.user_has_unit_access(unit_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.areas;

DROP POLICY IF EXISTS "auditores read auth" ON public.auditores;
CREATE POLICY "auditores read auth" ON public.auditores FOR SELECT TO authenticated USING (public.is_global_admin() OR NOT EXISTS (SELECT 1 FROM public.auditor_units(id)) OR EXISTS (SELECT 1 FROM public.auditor_units(id) u(unit_id) WHERE public.user_has_unit_access(u.unit_id)));
DROP POLICY IF EXISTS "sec11_auditores_select" ON public.auditores;

DROP POLICY IF EXISTS "auditorias read auth" ON public.auditorias;
CREATE POLICY "auditorias read auth" ON public.auditorias FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.auditorias;

DROP POLICY IF EXISTS "nc read auth" ON public.nao_conformidades;
CREATE POLICY "nc read auth" ON public.nao_conformidades FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.nao_conformidades;

DROP POLICY IF EXISTS "melhorias read auth" ON public.melhorias;
CREATE POLICY "melhorias read auth" ON public.melhorias FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.melhorias;

DROP POLICY IF EXISTS "gemba read auth" ON public.gemba_visitas;
CREATE POLICY "gemba read auth" ON public.gemba_visitas FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.gemba_visitas;

DROP POLICY IF EXISTS "alertas read auth" ON public.alertas_processo;
CREATE POLICY "alertas read auth" ON public.alertas_processo FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.alertas_processo;

DROP POLICY IF EXISTS "log read auth" ON public.auditorias_log;
CREATE POLICY "log read auth" ON public.auditorias_log FOR SELECT TO authenticated USING (public.row_access(unit_id, area_id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.auditorias_log;

DROP POLICY IF EXISTS "nc_historico read auth" ON public.nc_historico;
CREATE POLICY "nc_historico read auth" ON public.nc_historico FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.nao_conformidades n WHERE n.id = nc_id AND public.row_access(n.unit_id, n.area_id)));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.nc_historico;

DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (public.profile_visible(id));
DROP POLICY IF EXISTS "sec6_profiles_select" ON public.profiles;

DROP POLICY IF EXISTS "units_select_auth" ON public.units;
CREATE POLICY "units_select_auth" ON public.units FOR SELECT TO authenticated USING (public.user_has_unit_access(id));
DROP POLICY IF EXISTS "f2b_iso_select" ON public.units;
-- Verified on the live database: f2b_units_select uses the identical user_has_unit_access(id) predicate.
DROP POLICY IF EXISTS "f2b_units_select" ON public.units;

DROP POLICY IF EXISTS "perguntas_auditoria_read_auth" ON public.perguntas_auditoria;
CREATE POLICY "perguntas_auditoria_read_auth" ON public.perguntas_auditoria FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.areas a WHERE a.nome = perguntas_auditoria.area_nome AND (perguntas_auditoria.unit_id IS NULL OR a.unit_id = perguntas_auditoria.unit_id) AND public.user_has_unit_access(a.unit_id) AND public.user_has_area_access(a.id)));

DROP POLICY IF EXISTS "Auth read audit photos" ON storage.objects;
CREATE POLICY "Auth read audit photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audit-photos' AND public.evidence_read_allowed(name, owner));

DROP POLICY IF EXISTS "Auth upload audit photos" ON storage.objects;
CREATE POLICY "Auth upload audit photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-photos' AND lower(storage.extension(name)) IN ('jpg','jpeg','jfif','png','webp','heic','pdf') AND public.evidence_write_allowed(name));

DROP POLICY IF EXISTS "Auth update audit photos" ON storage.objects;
CREATE POLICY "Auth update audit photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'audit-photos' AND public.evidence_write_allowed(name) AND public.evidence_read_allowed(name, owner)) WITH CHECK (bucket_id = 'audit-photos' AND lower(storage.extension(name)) IN ('jpg','jpeg','jfif','png','webp','heic','pdf') AND public.evidence_write_allowed(name));

DROP POLICY IF EXISTS "Auth delete audit photos" ON storage.objects;
CREATE POLICY "Auth delete audit photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audit-photos' AND public.evidence_write_allowed(name) AND public.evidence_read_allowed(name, owner));

DROP POLICY IF EXISTS "f2b_ev_select" ON storage.objects;
DROP POLICY IF EXISTS "f2b_ev_insert" ON storage.objects;
DROP POLICY IF EXISTS "f2b_ev_update" ON storage.objects;
DROP POLICY IF EXISTS "f2b_ev_delete" ON storage.objects;