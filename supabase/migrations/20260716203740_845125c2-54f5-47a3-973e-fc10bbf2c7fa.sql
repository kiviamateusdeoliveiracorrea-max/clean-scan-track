
-- Perfis: campos adicionais
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- NCs: causa raiz, ações, documentos, quem atualizou
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS causa_raiz text,
  ADD COLUMN IF NOT EXISTS acao_corretiva text,
  ADD COLUMN IF NOT EXISTS acao_preventiva text,
  ADD COLUMN IF NOT EXISTS documento_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Trigger updated_at para nao_conformidades (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'nc_set_updated_at'
  ) THEN
    CREATE TRIGGER nc_set_updated_at
      BEFORE UPDATE ON public.nao_conformidades
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Histórico de alterações em NCs
CREATE TABLE IF NOT EXISTS public.nc_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.nao_conformidades(id) ON DELETE CASCADE,
  user_id uuid,
  user_nome text,
  acao text NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.nc_historico TO authenticated;
GRANT ALL ON public.nc_historico TO service_role;

ALTER TABLE public.nc_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nc_historico read auth" ON public.nc_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "nc_historico insert auth" ON public.nc_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'administrador'::app_role)
    OR has_role(auth.uid(), 'auditor'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_nc_historico_nc ON public.nc_historico(nc_id, created_at DESC);

-- handle_new_user atualizado para preencher cargo/area quando fornecidos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, cargo, area_id, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'cargo', ''),
    NULLIF(NEW.raw_user_meta_data->>'area_id','')::uuid,
    true
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', '')::public.app_role,
      'consulta'::public.app_role
    )
  );
  RETURN NEW;
END;
$function$;
