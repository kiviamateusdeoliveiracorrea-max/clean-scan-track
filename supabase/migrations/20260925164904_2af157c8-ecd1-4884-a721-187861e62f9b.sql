ALTER TABLE public.units ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVA';
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS observation text;
UPDATE public.units SET status = CASE WHEN active THEN 'ATIVA' ELSE 'INATIVA' END;
ALTER TABLE public.units ADD CONSTRAINT units_status_check CHECK (status IN ('ATIVA','INATIVA','EM_CONFIGURACAO'));
ALTER TABLE public.perguntas_auditoria ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id);
CREATE INDEX IF NOT EXISTS perguntas_auditoria_unit_idx ON public.perguntas_auditoria(unit_id);