
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS responsavel_nc_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_acao_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nc_resp_acao ON public.nao_conformidades(responsavel_acao_id);
CREATE INDEX IF NOT EXISTS idx_nc_aprovador ON public.nao_conformidades(aprovador_id);

-- Ampliar leitura de profiles para todos os autenticados (necessário para o seletor de responsáveis)
DROP POLICY IF EXISTS "profiles read own" ON public.profiles;
CREATE POLICY "profiles read all authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
