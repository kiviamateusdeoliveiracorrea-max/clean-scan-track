CREATE TABLE IF NOT EXISTS public.metas_processo (
  unit_id uuid PRIMARY KEY REFERENCES public.units(id),
  meta_semanal integer NOT NULL DEFAULT 0,
  meta_mensal integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_processo TO authenticated;
GRANT ALL ON public.metas_processo TO service_role;

ALTER TABLE public.metas_processo ENABLE ROW LEVEL SECURITY;

CREATE POLICY metas_processo_leitura ON public.metas_processo FOR SELECT TO authenticated
  USING (public.user_has_unit_access(unit_id));

CREATE POLICY metas_processo_escrita ON public.metas_processo FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(), 'administrador'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) AND public.user_has_unit_access(unit_id))
  WITH CHECK ((public.has_role(auth.uid(), 'administrador'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) AND public.user_has_unit_access(unit_id));