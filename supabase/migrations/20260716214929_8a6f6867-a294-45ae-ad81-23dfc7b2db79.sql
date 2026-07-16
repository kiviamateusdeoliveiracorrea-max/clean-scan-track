
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS data_conclusao timestamptz,
  ADD COLUMN IF NOT EXISTS parecer_aprovador text,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES public.profiles(id);
