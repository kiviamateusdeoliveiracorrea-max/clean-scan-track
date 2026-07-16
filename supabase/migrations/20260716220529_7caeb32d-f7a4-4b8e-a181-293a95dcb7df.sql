
ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS justificativa_cancelamento text;

CREATE TABLE IF NOT EXISTS public.auditorias_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid,
  area_id uuid,
  area_nome text,
  data_auditoria date,
  acao text NOT NULL,
  justificativa text,
  executado_por uuid REFERENCES public.profiles(id),
  executado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditorias_log TO authenticated;
GRANT ALL ON public.auditorias_log TO service_role;

ALTER TABLE public.auditorias_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log read auth" ON public.auditorias_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "log insert admin gestor" ON public.auditorias_log FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(),'administrador'::app_role) OR app_private.has_role(auth.uid(),'gestor'::app_role));
