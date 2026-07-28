ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS excluida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluida_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS excluida_por uuid,
  ADD COLUMN IF NOT EXISTS justificativa_exclusao text,
  ADD COLUMN IF NOT EXISTS status_anterior text;

CREATE INDEX IF NOT EXISTS nao_conformidades_excluida_idx ON public.nao_conformidades (excluida);