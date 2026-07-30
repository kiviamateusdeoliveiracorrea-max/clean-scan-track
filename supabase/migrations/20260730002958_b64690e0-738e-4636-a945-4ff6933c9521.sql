CREATE TABLE public.respostas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.perguntas_auditoria(id) ON DELETE CASCADE,
  resposta text NOT NULL,
  observacao text,
  foto_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT respostas_auditoria_resposta_check CHECK (resposta IN ('SIM', 'NÃO'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.respostas_auditoria TO authenticated;
GRANT ALL ON public.respostas_auditoria TO service_role;

ALTER TABLE public.respostas_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores podem gerenciar todas as respostas"
  ON public.respostas_auditoria
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Auditores podem inserir e atualizar respostas das auditorias que criaram"
  ON public.respostas_auditoria
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'auditor')
    AND EXISTS (
      SELECT 1 FROM public.auditorias a
      WHERE a.id = respostas_auditoria.auditoria_id
        AND a.auditor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'auditor')
    AND EXISTS (
      SELECT 1 FROM public.auditorias a
      WHERE a.id = respostas_auditoria.auditoria_id
        AND a.auditor_id = auth.uid()
    )
  );

CREATE POLICY "Usuários de consulta podem visualizar respostas"
  ON public.respostas_auditoria
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'consulta'));