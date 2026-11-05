DROP POLICY IF EXISTS "perguntas_auditoria_write_admin_gestor_auditor" ON public.perguntas_auditoria;
CREATE POLICY "perguntas_auditoria_write_admin_gestor_auditor" ON public.perguntas_auditoria FOR ALL TO authenticated
  USING (
    (app_private.has_role(auth.uid(), 'administrador'::public.app_role)
      OR app_private.has_role(auth.uid(), 'gestor'::public.app_role)
      OR app_private.has_role(auth.uid(), 'auditor'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.areas a
      WHERE a.nome = perguntas_auditoria.area_nome
        AND (perguntas_auditoria.unit_id IS NULL OR a.unit_id = perguntas_auditoria.unit_id)
        AND public.user_has_unit_access(a.unit_id)
        AND public.user_has_area_access(a.id)
    )
  )
  WITH CHECK (
    (app_private.has_role(auth.uid(), 'administrador'::public.app_role)
      OR app_private.has_role(auth.uid(), 'gestor'::public.app_role)
      OR app_private.has_role(auth.uid(), 'auditor'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.areas a
      WHERE a.nome = perguntas_auditoria.area_nome
        AND (perguntas_auditoria.unit_id IS NULL OR a.unit_id = perguntas_auditoria.unit_id)
        AND public.user_has_unit_access(a.unit_id)
        AND public.user_has_area_access(a.id)
    )
  );