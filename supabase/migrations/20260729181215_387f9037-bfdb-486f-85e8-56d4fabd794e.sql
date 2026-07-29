CREATE TABLE public.melhorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  processo text,
  data_identificacao date NOT NULL DEFAULT CURRENT_DATE,
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'Processo',
  foto_urls text[] NOT NULL DEFAULT '{}',
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'aberto',
  comentarios text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.melhorias TO authenticated;
GRANT ALL ON public.melhorias TO service_role;
ALTER TABLE public.melhorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "melhorias read auth" ON public.melhorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "melhorias insert" ON public.melhorias FOR INSERT TO authenticated WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "melhorias update" ON public.melhorias FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role)) WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "melhorias delete" ON public.melhorias FOR DELETE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role));
CREATE TRIGGER melhorias_set_updated_at BEFORE UPDATE ON public.melhorias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.gemba_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  data_visita date NOT NULL DEFAULT CURRENT_DATE,
  participantes text,
  ponto_positivo text,
  oportunidade text,
  foto_antes_urls text[] NOT NULL DEFAULT '{}',
  foto_depois_urls text[] NOT NULL DEFAULT '{}',
  acao_definida text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gemba_visitas TO authenticated;
GRANT ALL ON public.gemba_visitas TO service_role;
ALTER TABLE public.gemba_visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gemba read auth" ON public.gemba_visitas FOR SELECT TO authenticated USING (true);
CREATE POLICY "gemba insert" ON public.gemba_visitas FOR INSERT TO authenticated WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "gemba update" ON public.gemba_visitas FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role)) WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "gemba delete" ON public.gemba_visitas FOR DELETE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role));
CREATE TRIGGER gemba_set_updated_at BEFORE UPDATE ON public.gemba_visitas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.alertas_processo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  foto_urls text[] NOT NULL DEFAULT '{}',
  procedimento text,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_processo TO authenticated;
GRANT ALL ON public.alertas_processo TO service_role;
ALTER TABLE public.alertas_processo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas read auth" ON public.alertas_processo FOR SELECT TO authenticated USING (true);
CREATE POLICY "alertas insert" ON public.alertas_processo FOR INSERT TO authenticated WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "alertas update" ON public.alertas_processo FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role)) WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role) OR app_private.has_role(auth.uid(),'auditor'::app_role));
CREATE POLICY "alertas delete" ON public.alertas_processo FOR DELETE TO authenticated USING (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role));
CREATE TRIGGER alertas_set_updated_at BEFORE UPDATE ON public.alertas_processo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();