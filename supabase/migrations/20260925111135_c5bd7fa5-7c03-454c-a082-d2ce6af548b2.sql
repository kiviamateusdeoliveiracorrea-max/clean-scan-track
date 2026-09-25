CREATE TABLE public.evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  event text NOT NULL CHECK (event IN ('UPLOAD_REALIZADO','UPLOAD_CANCELADO','ROLLBACK_EXECUTADO','FALHA_GRAVACAO','ORFAO_DETECTADO','LIMPEZA_ORFAO','ORFAO_MANTIDO','ORFAO_ARQUIVADO','ORFAO_VINCULADO')),
  context text,
  record_id uuid,
  unit_id uuid REFERENCES public.units(id),
  path text,
  mime text,
  size_bytes bigint,
  result text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.evidence_events TO authenticated;
GRANT ALL ON public.evidence_events TO service_role;
ALTER TABLE public.evidence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence event insert" ON public.evidence_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND event IN ('UPLOAD_REALIZADO','UPLOAD_CANCELADO','ROLLBACK_EXECUTADO','FALHA_GRAVACAO'));
CREATE INDEX evidence_events_path_idx ON public.evidence_events(path);

CREATE TABLE public.orphan_file_reviews (
  path text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('EM_ANALISE','MANTIDO','ARQUIVADO','VINCULADO','EXCLUIDO')),
  justification text,
  linked_record text,
  reviewed_by uuid,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orphan_file_reviews TO service_role;
ALTER TABLE public.orphan_file_reviews ENABLE ROW LEVEL SECURITY;