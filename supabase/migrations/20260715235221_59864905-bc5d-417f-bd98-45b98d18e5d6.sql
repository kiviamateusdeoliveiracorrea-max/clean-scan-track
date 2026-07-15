
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  setor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO anon, authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access areas" ON public.areas FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.auditores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  matricula TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditores TO anon, authenticated;
GRANT ALL ON public.auditores TO service_role;
ALTER TABLE public.auditores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access auditores" ON public.auditores FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.auditorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  auditor_id UUID REFERENCES public.auditores(id) ON DELETE SET NULL,
  data_auditoria DATE NOT NULL DEFAULT CURRENT_DATE,
  seiri INTEGER NOT NULL DEFAULT 0,
  seiton INTEGER NOT NULL DEFAULT 0,
  seiso INTEGER NOT NULL DEFAULT 0,
  seiketsu INTEGER NOT NULL DEFAULT 0,
  shitsuke INTEGER NOT NULL DEFAULT 0,
  pontuacao_total INTEGER NOT NULL DEFAULT 0,
  percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'concluida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias TO anon, authenticated;
GRANT ALL ON public.auditorias TO service_role;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access auditorias" ON public.auditorias FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.nao_conformidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID REFERENCES public.auditorias(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  criterio TEXT NOT NULL,
  descricao TEXT NOT NULL,
  foto_url TEXT,
  plano_acao TEXT,
  responsavel TEXT,
  prazo DATE,
  severidade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nao_conformidades TO anon, authenticated;
GRANT ALL ON public.nao_conformidades TO service_role;
ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access nc" ON public.nao_conformidades FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_auditorias_data ON public.auditorias(data_auditoria DESC);
CREATE INDEX idx_auditorias_area ON public.auditorias(area_id);
CREATE INDEX idx_nc_auditoria ON public.nao_conformidades(auditoria_id);
CREATE INDEX idx_nc_status ON public.nao_conformidades(status);
