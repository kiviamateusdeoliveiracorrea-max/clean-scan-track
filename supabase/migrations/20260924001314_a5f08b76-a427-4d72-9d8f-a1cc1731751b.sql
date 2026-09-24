-- ===== 1. Funções de segurança (com fallback transitório documentado) =====
DROP FUNCTION IF EXISTS public.is_unit_admin(uuid);
DROP FUNCTION IF EXISTS public.user_has_area_access(uuid);
DROP FUNCTION IF EXISTS public.user_has_unit_role(uuid, public.unit_role);
DROP FUNCTION IF EXISTS public.user_has_unit_access(uuid);
-- FALLBACK TRANSITÓRIO: o papel antigo 'administrador' (app_private.has_role) só preserva
-- administração de unidade/áreas onde o usuário JÁ possui vínculo ativo em user_unit_permissions
-- (hoje apenas Cummins Motores). Nunca concede acesso a unidades futuras. Remover na Fase 2C.
CREATE OR REPLACE FUNCTION public.is_global_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_unit_permissions p JOIN public.units u ON u.id = p.unit_id
    WHERE p.user_id = auth.uid() AND p.active AND u.active AND p.role = 'ADMIN_GLOBAL' AND p.validation_status = 'VALIDADO')
$$;
CREATE OR REPLACE FUNCTION public.user_has_unit_access(target_unit_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.is_global_admin() OR EXISTS (SELECT 1 FROM public.user_unit_permissions p JOIN public.units u ON u.id = p.unit_id
    WHERE p.user_id = auth.uid() AND p.unit_id = target_unit_id AND p.active AND u.active)
$$;
CREATE OR REPLACE FUNCTION public.user_has_unit_role(target_unit_id uuid, target_role public.unit_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_unit_permissions p JOIN public.units u ON u.id = p.unit_id
    WHERE p.user_id = auth.uid() AND p.unit_id = target_unit_id AND p.active AND u.active AND p.role = target_role)
$$;
CREATE OR REPLACE FUNCTION public.is_unit_admin(target_unit_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.is_global_admin()
    OR public.user_has_unit_role(target_unit_id, 'ADMIN_UNIDADE')
    OR (app_private.has_role(auth.uid(), 'administrador') AND public.user_has_unit_access(target_unit_id)) -- fallback transitório
$$;
CREATE OR REPLACE FUNCTION public.user_has_area_access(target_area_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = target_area_id AND a.unit_id IS NOT NULL AND public.user_has_unit_access(a.unit_id)
      AND ( public.is_unit_admin(a.unit_id)
         OR EXISTS (SELECT 1 FROM public.user_area_permissions ap WHERE ap.user_id = auth.uid() AND ap.area_id = a.id AND ap.unit_id = a.unit_id AND ap.active)
         OR (app_private.has_role(auth.uid(), 'gestor')) -- fallback transitório: gestor vê áreas da unidade vinculada
      ))
$$;
REVOKE ALL ON FUNCTION public.is_global_admin(), public.user_has_unit_access(uuid), public.user_has_unit_role(uuid, public.unit_role), public.is_unit_admin(uuid), public.user_has_area_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_global_admin(), public.user_has_unit_access(uuid), public.user_has_unit_role(uuid, public.unit_role), public.is_unit_admin(uuid), public.user_has_area_access(uuid) TO authenticated, service_role;

-- ===== 2. admin_logs.unit_id =====
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
COMMENT ON COLUMN public.admin_logs.unit_id IS 'Nulo somente para ações verdadeiramente globais; ações sobre usuário/área/registro local exigem unidade.';
COMMENT ON TABLE public.nc_historico IS 'Unidade herdada de nao_conformidades.unit_id via nc_id (sem coluna própria).';
COMMENT ON TABLE public.respostas_auditoria IS 'Unidade herdada de auditorias.unit_id via auditoria_id (sem coluna própria).';
COMMENT ON TABLE public.perguntas_auditoria IS 'Modelo global (Fase 2A). Não pertence a unidade.';
COMMENT ON TABLE public.auditores IS 'Cadastro global. Acesso futuro determinado por user_unit_permissions/user_area_permissions.';

-- ===== 5. Gatilhos =====
CREATE OR REPLACE FUNCTION public.set_unit_from_area() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_unit uuid; v_active boolean; v_parent uuid;
BEGIN
  -- Correção administrativa controlada: somente com app.unit_correction='on' (definido apenas em migração/servidor)
  IF TG_OP = 'UPDATE' AND coalesce(current_setting('app.unit_correction', true),'') = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.unit_id IS DISTINCT FROM OLD.unit_id AND OLD.unit_id IS NOT NULL
     AND NEW.area_id IS NOT DISTINCT FROM OLD.area_id THEN
    RAISE EXCEPTION 'Alteração direta da unidade não é permitida' USING ERRCODE = '42501';
  END IF;

  IF NEW.area_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.area_id IS DISTINCT FROM OLD.area_id) THEN
    SELECT unit_id, active INTO v_unit, v_active FROM public.areas WHERE id = NEW.area_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Área inexistente' USING ERRCODE = '23503'; END IF;
    IF v_unit IS NULL THEN RAISE EXCEPTION 'Área sem unidade' USING ERRCODE = '23502'; END IF;
    IF TG_OP = 'INSERT' AND NOT v_active THEN RAISE EXCEPTION 'Área inativa' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' AND OLD.unit_id IS NOT NULL AND v_unit <> OLD.unit_id THEN
      RAISE EXCEPTION 'Não é permitido mover o registro para área de outra unidade' USING ERRCODE = '42501';
    END IF;
    NEW.unit_id := v_unit;  -- nunca confia no valor enviado pelo cliente
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.unit_id := OLD.unit_id;
  ELSE
    NEW.unit_id := NULL;
  END IF;

  -- Registro pai (auditoria) deve ser da mesma unidade
  IF TG_TABLE_NAME IN ('nao_conformidades','auditorias_log') AND NEW.auditoria_id IS NOT NULL THEN
    SELECT unit_id INTO v_parent FROM public.auditorias WHERE id = NEW.auditoria_id;
    IF NEW.unit_id IS NULL THEN NEW.unit_id := v_parent;
    ELSIF v_parent IS NOT NULL AND v_parent <> NEW.unit_id THEN
      RAISE EXCEPTION 'Auditoria e registro pertencem a unidades diferentes' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.unit_id IS NULL AND TG_TABLE_NAME <> 'auditorias_log' THEN
    RAISE EXCEPTION 'Registro sem unidade válida (informe uma área)' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_unit_from_area() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auditorias_log_set_unit ON public.auditorias_log;
CREATE TRIGGER auditorias_log_set_unit BEFORE INSERT OR UPDATE ON public.auditorias_log FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();

CREATE OR REPLACE FUNCTION public.set_admin_log_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.unit_id := OLD.unit_id; RETURN NEW; END IF;
  IF NEW.target_user_id IS NOT NULL THEN
    SELECT unit_id INTO NEW.unit_id FROM public.user_unit_permissions
      WHERE user_id = NEW.target_user_id ORDER BY is_default_unit DESC, created_at LIMIT 1;
    IF NEW.unit_id IS NULL THEN RAISE EXCEPTION 'Ação sobre usuário sem unidade vinculada' USING ERRCODE = '23502'; END IF;
  ELSE
    NEW.unit_id := NULL; -- ação global
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_log_unit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER admin_logs_set_unit BEFORE INSERT OR UPDATE ON public.admin_logs FOR EACH ROW EXECUTE FUNCTION public.set_admin_log_unit();

-- ===== 4. Diagnóstico de consistência (somente administradores do serviço) =====
CREATE OR REPLACE FUNCTION public.multiunit_consistency_report() RETURNS TABLE(check_name text, qtd bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT 'auditorias_unit_diferente_area', count(*) FROM auditorias t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'nc_unit_diferente_area', count(*) FROM nao_conformidades t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'nc_unit_diferente_auditoria', count(*) FROM nao_conformidades n JOIN auditorias au ON au.id=n.auditoria_id WHERE n.unit_id IS DISTINCT FROM au.unit_id
  UNION ALL SELECT 'historico_sem_nc_com_unidade', count(*) FROM nc_historico h LEFT JOIN nao_conformidades n ON n.id=h.nc_id WHERE n.unit_id IS NULL
  UNION ALL SELECT 'respostas_sem_auditoria_com_unidade', count(*) FROM respostas_auditoria r LEFT JOIN auditorias au ON au.id=r.auditoria_id WHERE au.unit_id IS NULL
  UNION ALL SELECT 'melhorias_unit_diferente_area', count(*) FROM melhorias t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'gemba_unit_diferente_area', count(*) FROM gemba_visitas t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'alertas_unit_diferente_area', count(*) FROM alertas_processo t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'auditorias_log_unit_diferente_area', count(*) FROM auditorias_log t JOIN areas a ON a.id=t.area_id WHERE t.unit_id IS DISTINCT FROM a.unit_id
  UNION ALL SELECT 'admin_logs_usuario_sem_unidade', count(*) FROM admin_logs WHERE target_user_id IS NOT NULL AND unit_id IS NULL
$$;
REVOKE ALL ON FUNCTION public.multiunit_consistency_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.multiunit_consistency_report() TO service_role;

-- ===== 6. Índices (somente inexistentes) =====
CREATE INDEX IF NOT EXISTS idx_auditorias_unit_created ON public.auditorias(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_nc_area ON public.nao_conformidades(area_id);
CREATE INDEX IF NOT EXISTS idx_nc_unit_created ON public.nao_conformidades(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_melhorias_area ON public.melhorias(area_id);
CREATE INDEX IF NOT EXISTS idx_melhorias_unit_status ON public.melhorias(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_melhorias_unit_created ON public.melhorias(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gemba_area ON public.gemba_visitas(area_id);
CREATE INDEX IF NOT EXISTS idx_gemba_unit_status ON public.gemba_visitas(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_gemba_unit_created ON public.gemba_visitas(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alertas_area ON public.alertas_processo(area_id);
CREATE INDEX IF NOT EXISTS idx_alertas_unit_status ON public.alertas_processo(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_alertas_unit_created ON public.alertas_processo(unit_id, created_at);
DROP INDEX IF EXISTS public.idx_auditorias_log_unit;
CREATE INDEX IF NOT EXISTS idx_auditorias_log_unit_created ON public.auditorias_log(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auditorias_log_auditoria ON public.auditorias_log(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_unit_created ON public.admin_logs(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_respostas_auditoria_auditoria ON public.respostas_auditoria(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_uap_user_active ON public.user_area_permissions(user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_uup_user_active ON public.user_unit_permissions(user_id) WHERE active;