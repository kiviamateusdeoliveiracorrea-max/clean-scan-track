CREATE UNIQUE INDEX IF NOT EXISTS respostas_auditoria_unica ON public.respostas_auditoria (auditoria_id, pergunta_id);

ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS nota_pessoas numeric,
  ADD COLUMN IF NOT EXISTS nota_ambiente numeric,
  ADD COLUMN IF NOT EXISTS nota_processo numeric;