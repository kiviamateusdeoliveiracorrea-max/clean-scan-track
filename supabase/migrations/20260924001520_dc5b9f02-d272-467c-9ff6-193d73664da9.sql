ALTER TABLE public.auditorias ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.nao_conformidades ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.melhorias ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.gemba_visitas ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.alertas_processo ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.auditorias_log ALTER COLUMN unit_id SET NOT NULL;