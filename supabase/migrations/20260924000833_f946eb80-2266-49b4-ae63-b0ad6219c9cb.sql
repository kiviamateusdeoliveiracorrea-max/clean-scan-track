-- Funções de verificação (ainda não usadas pelas regras de acesso)
CREATE OR REPLACE FUNCTION public.is_global_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_unit_permissions WHERE user_id = auth.uid() AND active AND role = 'ADMIN_GLOBAL' AND validation_status = 'VALIDADO')
$$;
CREATE OR REPLACE FUNCTION public.user_has_unit_access(_unit_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin() OR EXISTS (SELECT 1 FROM public.user_unit_permissions WHERE user_id = auth.uid() AND unit_id = _unit_id AND active)
$$;
CREATE OR REPLACE FUNCTION public.user_has_area_access(_area_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin() OR EXISTS (SELECT 1 FROM public.user_area_permissions WHERE user_id = auth.uid() AND area_id = _area_id AND active)
$$;
CREATE OR REPLACE FUNCTION public.user_has_unit_role(_unit_id uuid, _role public.unit_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_unit_permissions WHERE user_id = auth.uid() AND unit_id = _unit_id AND active AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_unit_admin(_unit_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin() OR public.user_has_unit_role(_unit_id, 'ADMIN_UNIDADE')
$$;

-- Colunas de unidade (nuláveis nesta etapa)
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
ALTER TABLE public.nao_conformidades ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
ALTER TABLE public.melhorias ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
ALTER TABLE public.gemba_visitas ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
ALTER TABLE public.alertas_processo ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
ALTER TABLE public.auditorias_log ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);

-- Gatilho: unidade sempre derivada da área; impede troca de unidade
CREATE OR REPLACE FUNCTION public.set_unit_from_area() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF NEW.area_id IS NOT NULL THEN
    SELECT unit_id INTO v FROM public.areas WHERE id = NEW.area_id;
    NEW.unit_id := v;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.unit_id := OLD.unit_id;
  ELSE
    NEW.unit_id := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.unit_id IS NOT NULL AND NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
    RAISE EXCEPTION 'Não é permitido mover o registro para outra unidade';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER auditorias_set_unit BEFORE INSERT OR UPDATE ON public.auditorias FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();
CREATE TRIGGER nc_set_unit BEFORE INSERT OR UPDATE ON public.nao_conformidades FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();
CREATE TRIGGER melhorias_set_unit BEFORE INSERT OR UPDATE ON public.melhorias FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();
CREATE TRIGGER gemba_set_unit BEFORE INSERT OR UPDATE ON public.gemba_visitas FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();
CREATE TRIGGER alertas_set_unit BEFORE INSERT OR UPDATE ON public.alertas_processo FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();
CREATE TRIGGER auditorias_log_set_unit BEFORE INSERT ON public.auditorias_log FOR EACH ROW EXECUTE FUNCTION public.set_unit_from_area();

-- Índices
CREATE INDEX IF NOT EXISTS idx_auditorias_unit ON public.auditorias(unit_id, area_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_unit_status ON public.auditorias(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_nc_unit ON public.nao_conformidades(unit_id, area_id);
CREATE INDEX IF NOT EXISTS idx_nc_unit_status ON public.nao_conformidades(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_melhorias_unit ON public.melhorias(unit_id, area_id);
CREATE INDEX IF NOT EXISTS idx_gemba_unit ON public.gemba_visitas(unit_id, area_id);
CREATE INDEX IF NOT EXISTS idx_alertas_unit ON public.alertas_processo(unit_id, area_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_log_unit ON public.auditorias_log(unit_id);