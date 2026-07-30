CREATE TABLE public.perguntas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_nome text NOT NULL,
  categoria text NOT NULL,
  pergunta text NOT NULL,
  peso numeric NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT perguntas_auditoria_categoria_check CHECK (categoria IN ('Pessoas', 'Ambiente', 'Processo')),
  CONSTRAINT perguntas_auditoria_peso_positivo CHECK (peso > 0)
);

GRANT SELECT ON public.perguntas_auditoria TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.perguntas_auditoria TO authenticated;
GRANT ALL ON public.perguntas_auditoria TO service_role;

ALTER TABLE public.perguntas_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perguntas_auditoria_read_auth"
  ON public.perguntas_auditoria
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "perguntas_auditoria_write_admin_gestor_auditor"
  ON public.perguntas_auditoria
  FOR ALL
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE TRIGGER update_perguntas_auditoria_updated_at
  BEFORE UPDATE ON public.perguntas_auditoria
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();