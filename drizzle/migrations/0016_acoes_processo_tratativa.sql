ALTER TABLE public.acoes_processo
  ADD COLUMN IF NOT EXISTS tratativa text,
  ADD COLUMN IF NOT EXISTS evidencias text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tratado_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS tratado_em timestamptz;
CREATE INDEX IF NOT EXISTS acoes_processo_status_idx ON public.acoes_processo(status);

CREATE OR REPLACE FUNCTION public.evidence_owner(_path text)
 RETURNS TABLE(unit_id uuid, area_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH s AS (SELECT split_part(_path,'/',1) AS seg)
  SELECT a.unit_id, a.area_id FROM public.auditorias a, s WHERE a.id::text = s.seg OR _path = ANY(a.fotos)
  UNION ALL SELECT n.unit_id, n.area_id FROM public.nao_conformidades n, s
    WHERE n.id::text = s.seg OR n.foto_url = _path OR _path = ANY(n.foto_urls) OR _path = ANY(n.documento_urls)
  UNION ALL SELECT m.unit_id, m.area_id FROM public.melhorias m, s WHERE m.id::text = s.seg OR _path = ANY(m.foto_urls)
  UNION ALL SELECT g.unit_id, g.area_id FROM public.gemba_visitas g, s WHERE g.id::text = s.seg OR _path = ANY(g.foto_antes_urls) OR _path = ANY(g.foto_depois_urls)
  UNION ALL SELECT x.unit_id, x.area_id FROM public.alertas_processo x, s WHERE x.id::text = s.seg OR _path = ANY(x.foto_urls)
  UNION ALL SELECT a.unit_id, a.area_id FROM public.respostas_auditoria r JOIN public.auditorias a ON a.id = r.auditoria_id WHERE r.foto_url = _path
  UNION ALL SELECT ap.unit_id, ap.area_id FROM public.auditorias_processo ap, s WHERE ap.id::text = s.seg OR _path = ANY(ap.fotos)
  UNION ALL SELECT ap.unit_id, ap.area_id FROM public.respostas_processo rp JOIN public.auditorias_processo ap ON ap.id = rp.auditoria_processo_id WHERE rp.foto_url = _path OR _path = ANY(rp.foto_urls)
  UNION ALL SELECT ap.unit_id, ap.area_id FROM public.acoes_processo ac JOIN public.auditorias_processo ap ON ap.id = ac.auditoria_processo_id, s
    WHERE ac.id::text = s.seg OR _path = ANY(ac.evidencias)
$function$;