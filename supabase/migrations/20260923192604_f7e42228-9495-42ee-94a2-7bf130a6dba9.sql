CREATE TYPE public.unit_role AS ENUM ('ADMIN_GLOBAL','ADMIN_UNIDADE','ANALISTA','LIDER','COORDENADOR','GERENTE','CONSULTOR');

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  company_name text, city text, state text,
  active boolean NOT NULL DEFAULT true,
  logo_path text, primary_color text, secondary_color text,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
GRANT SELECT ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY units_select_auth ON public.units FOR SELECT TO authenticated USING (true);
CREATE TRIGGER units_set_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_unit_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id),
  role public.unit_role,
  active boolean NOT NULL DEFAULT true,
  is_default_unit boolean NOT NULL DEFAULT false,
  validation_status text NOT NULL DEFAULT 'PENDENTE_DE_VALIDACAO' CHECK (validation_status IN ('VALIDADO','PENDENTE_DE_VALIDACAO','PENDENTE_AREA')),
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (user_id, unit_id)
);
CREATE INDEX idx_uup_unit ON public.user_unit_permissions(unit_id);
GRANT SELECT ON public.user_unit_permissions TO authenticated;
GRANT ALL ON public.user_unit_permissions TO service_role;
ALTER TABLE public.user_unit_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY uup_select ON public.user_unit_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrador'));
CREATE TRIGGER uup_set_updated_at BEFORE UPDATE ON public.user_unit_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_area_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id),
  area_id uuid NOT NULL REFERENCES public.areas(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (user_id, area_id)
);
CREATE INDEX idx_uap_unit_area ON public.user_area_permissions(unit_id, area_id);
GRANT SELECT ON public.user_area_permissions TO authenticated;
GRANT ALL ON public.user_area_permissions TO service_role;
ALTER TABLE public.user_area_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY uap_select ON public.user_area_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrador'));
CREATE TRIGGER uap_set_updated_at BEFORE UPDATE ON public.user_area_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.unit_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id),
  user_id uuid,
  action text NOT NULL, entity text, entity_id uuid,
  previous_value jsonb, new_value jsonb, justification text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ual_unit_created ON public.unit_audit_log(unit_id, created_at);
GRANT SELECT ON public.unit_audit_log TO authenticated;
GRANT ALL ON public.unit_audit_log TO service_role;
ALTER TABLE public.unit_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ual_select_admin ON public.unit_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrador'));

ALTER TABLE public.areas
  ADD COLUMN unit_id uuid REFERENCES public.units(id),
  ADD COLUMN code text,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.areas ADD CONSTRAINT areas_unit_code_unique UNIQUE (unit_id, code);
CREATE INDEX idx_areas_unit ON public.areas(unit_id);
CREATE TRIGGER areas_set_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dados
INSERT INTO public.units (code, name, company_name, city, state, active)
VALUES ('MOT','Cummins Motores','Cummins','Guarulhos','SP',true);

UPDATE public.areas SET unit_id = (SELECT id FROM public.units WHERE code='MOT') WHERE unit_id IS NULL;

INSERT INTO public.user_unit_permissions (user_id, unit_id, role, active, is_default_unit, validation_status)
SELECT p.id, u.id,
  CASE WHEN lower(p.email)='as73i@cummins.com' THEN 'ADMIN_GLOBAL'::public.unit_role
       WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='administrador') THEN 'ADMIN_UNIDADE'
       WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='gestor') THEN 'GERENTE'
       ELSE NULL END,
  (p.ativo AND NOT p.excluido), true,
  CASE WHEN p.area_id IS NULL THEN 'PENDENTE_AREA'
       WHEN lower(p.email)='as73i@cummins.com' THEN 'VALIDADO'
       ELSE 'PENDENTE_DE_VALIDACAO' END
FROM public.profiles p CROSS JOIN public.units u WHERE u.code='MOT';

INSERT INTO public.user_area_permissions (user_id, unit_id, area_id, active)
SELECT p.id, a.unit_id, p.area_id, (p.ativo AND NOT p.excluido)
FROM public.profiles p JOIN public.areas a ON a.id=p.area_id;

INSERT INTO public.unit_audit_log (unit_id, action, entity, entity_id, new_value, justification)
SELECT id, 'unidade_criada', 'units', id, jsonb_build_object('code',code,'name',name), 'Fase 1 multiunidade - migração inicial' FROM public.units WHERE code='MOT';
INSERT INTO public.unit_audit_log (unit_id, user_id, action, entity, entity_id, new_value, justification)
SELECT unit_id, user_id, 'acesso_unidade_atribuido', 'user_unit_permissions', id, jsonb_build_object('role',role,'validation_status',validation_status,'active',active), 'Fase 1 multiunidade - migração inicial' FROM public.user_unit_permissions;
INSERT INTO public.unit_audit_log (unit_id, user_id, action, entity, entity_id, new_value, justification)
SELECT unit_id, user_id, 'acesso_area_atribuido', 'user_area_permissions', id, jsonb_build_object('area_id',area_id,'active',active), 'Fase 1 multiunidade - migração inicial' FROM public.user_area_permissions;