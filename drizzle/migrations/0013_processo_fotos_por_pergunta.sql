ALTER TABLE public.respostas_processo ADD COLUMN IF NOT EXISTS foto_urls text[] NOT NULL DEFAULT '{}';
UPDATE public.respostas_processo SET foto_urls = ARRAY[foto_url] WHERE foto_url IS NOT NULL AND foto_urls = '{}';

CREATE OR REPLACE FUNCTION public.complete_audit_processo(p_id uuid,p_audit jsonb,p_answers jsonb,p_acoes jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.auditorias_processo; r jsonb; q record; action jsonb; fotos_q text[]; expected integer:=0; changed integer; np numeric; na numeric; npr numeric; cp integer:=0; ca integer:=0; cpr integer:=0; sp integer:=0; sa integer:=0; spr integer:=0;
BEGIN
SELECT * INTO a FROM public.auditorias_processo WHERE id=p_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria de processos indisponível ou sem permissão.'; END IF;
IF a.status='concluida' THEN RETURN p_id; END IF;
IF a.status<>'rascunho' THEN RAISE EXCEPTION 'Somente rascunhos podem ser concluídos.'; END IF;
IF jsonb_typeof(p_audit) IS DISTINCT FROM 'object' OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_typeof(p_acoes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Cabeçalho inválido ou respostas e ações não são listas.'; END IF;
IF (p_audit->>'area_id')::uuid IS DISTINCT FROM a.area_id THEN RAISE EXCEPTION 'A área do rascunho não pode ser alterada.'; END IF;
IF p_audit ? 'unit_id' AND (p_audit->>'unit_id')::uuid IS DISTINCT FROM a.unit_id THEN RAISE EXCEPTION 'A unidade do rascunho não pode ser alterada.'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) x GROUP BY x->>'pergunta_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Perguntas duplicadas nas respostas.'; END IF;
FOR q IN SELECT p.id,p.pergunta,p.categoria FROM public.perguntas_processo p JOIN public.areas ar ON ar.id=a.area_id WHERE p.ativo AND p.area_nome=ar.nome AND (p.unit_id=a.unit_id OR (p.unit_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.perguntas_processo own WHERE own.ativo AND own.area_nome=ar.nome AND own.unit_id=a.unit_id))) ORDER BY p.categoria,p.ordem,p.id LOOP
expected:=expected+1;
SELECT value INTO r FROM jsonb_array_elements(p_answers) WHERE value->>'pergunta_id'=q.id::text;
IF r IS NULL OR COALESCE(r->>'resposta','') NOT IN ('SIM','NÃO','NA') THEN RAISE EXCEPTION 'Resposta inválida ou ausente: %',q.pergunta; END IF;
fotos_q := CASE WHEN jsonb_typeof(r->'foto_urls')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'foto_urls')) WHEN NULLIF(r->>'foto_url','') IS NOT NULL THEN ARRAY[r->>'foto_url'] ELSE '{}'::text[] END;
INSERT INTO public.respostas_processo(auditoria_processo_id,pergunta_id,resposta,observacao,foto_url,foto_urls) VALUES(p_id,q.id,r->>'resposta',r->>'observacao',fotos_q[1],fotos_q) ON CONFLICT(auditoria_processo_id,pergunta_id) DO UPDATE SET resposta=excluded.resposta,observacao=excluded.observacao,foto_url=excluded.foto_url,foto_urls=excluded.foto_urls;
IF r->>'resposta'<>'NA' THEN
IF q.categoria='Pessoas' THEN cp:=cp+1; IF r->>'resposta'='SIM' THEN sp:=sp+1; END IF;
ELSIF q.categoria='Ambiente' THEN ca:=ca+1; IF r->>'resposta'='SIM' THEN sa:=sa+1; END IF;
ELSE cpr:=cpr+1; IF r->>'resposta'='SIM' THEN spr:=spr+1; END IF; END IF;
END IF;
END LOOP;
IF expected=0 OR expected<>jsonb_array_length(p_answers) THEN RAISE EXCEPTION 'O checklist mudou ou não possui respostas válidas. Reabra a auditoria.'; END IF;
IF cp=0 OR ca=0 OR cpr=0 THEN RAISE EXCEPTION 'Cada pilar precisa de ao menos uma resposta SIM ou NÃO (não pode ter todas marcadas como N/A).'; END IF;
np:=100.0*sp/cp; na:=100.0*sa/ca; npr:=100.0*spr/cpr;
IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers) ans WHERE ans->>'resposta'='NÃO' AND NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_acoes) ac WHERE ac->>'pergunta_id'=ans->>'pergunta_id' AND NULLIF(btrim(ac->>'o_que'),'') IS NOT NULL)) THEN
  RAISE EXCEPTION 'Toda pergunta respondida como Não precisa de uma ação cadastrada (a foto não substitui a ação).';
END IF;
FOR action IN SELECT value FROM jsonb_array_elements(p_acoes) LOOP
IF jsonb_typeof(action) IS DISTINCT FROM 'object' OR NULLIF(btrim(action->>'o_que'),'') IS NULL THEN RAISE EXCEPTION 'Informe o que será feito em cada ação.'; END IF;
IF action ? 'pergunta_id' AND action->>'pergunta_id' IS NOT NULL THEN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers) WHERE value->>'pergunta_id' = action->>'pergunta_id' AND value->>'resposta' = 'NÃO') THEN
    RAISE EXCEPTION 'Uma ação só pode ser vinculada a uma pergunta respondida como Não.';
  END IF;
END IF;
INSERT INTO public.acoes_processo(auditoria_processo_id,pergunta_id,o_que,como,responsavel_id,prazo,status) VALUES(p_id,(action->>'pergunta_id')::uuid,action->>'o_que',action->>'como',(action->>'responsavel_id')::uuid,(action->>'prazo')::date,COALESCE(action->>'status','aberta'));
END LOOP;
UPDATE public.auditorias_processo SET auditor_id=x.auditor_id,colaborador_auditado=x.colaborador_auditado,documento_referencia=x.documento_referencia,data_auditoria=COALESCE(x.data_auditoria,a.data_auditoria),turno=x.turno,nota_pessoas=np,nota_ambiente=na,nota_processo=npr,nota_final=(np+na+npr)/3,processo_claro=x.processo_claro,processo_claro_observacao=x.processo_claro_observacao,observacoes=x.observacoes,fotos=COALESCE(x.fotos,'{}'),status='concluida' FROM jsonb_populate_record(NULL::public.auditorias_processo,p_audit) x WHERE auditorias_processo.id=p_id;
GET DIAGNOSTICS changed=ROW_COUNT;
IF changed<>1 THEN RAISE EXCEPTION 'Sem permissão para concluir auditoria de processos.'; END IF;
RETURN p_id; END $$;

CREATE OR REPLACE FUNCTION public.edit_completed_audit_processo(p_id uuid, p_audit jsonb, p_answers jsonb, p_acoes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE a public.auditorias_processo; r jsonb; q record; action jsonb; fotos_q text[]; expected integer:=0; changed integer;
  np numeric; na numeric; npr numeric; cp integer:=0; ca integer:=0; cpr integer:=0; sp integer:=0; sa integer:=0; spr integer:=0;
  seen_ids uuid[] := '{}'; v_status text;
BEGIN
  SELECT * INTO a FROM public.auditorias_processo WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria de processos indisponível ou sem permissão.'; END IF;
  IF a.status<>'concluida' THEN RAISE EXCEPTION 'Somente auditorias concluídas podem ser editadas por aqui. Use a tela de preenchimento para rascunhos.'; END IF;
  IF NOT (public.has_role(auth.uid(),'administrador'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role) OR public.is_processo_audit_owner(a.auditor_id)) THEN RAISE EXCEPTION 'Sem permissão para editar esta auditoria de processos.'; END IF;
  IF jsonb_typeof(p_audit) IS DISTINCT FROM 'object' OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_typeof(p_acoes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Cabeçalho inválido, respostas ou ações não são uma lista.'; END IF;
  IF (p_audit->>'area_id')::uuid IS DISTINCT FROM a.area_id THEN RAISE EXCEPTION 'A área da auditoria não pode ser alterada.'; END IF;
  IF p_audit ? 'unit_id' AND (p_audit->>'unit_id')::uuid IS DISTINCT FROM a.unit_id THEN RAISE EXCEPTION 'A unidade da auditoria não pode ser alterada.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) x GROUP BY x->>'pergunta_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Perguntas duplicadas nas respostas.'; END IF;
  FOR q IN SELECT p.id,p.pergunta,p.categoria FROM public.perguntas_processo p JOIN public.areas ar ON ar.id=a.area_id WHERE p.ativo AND p.area_nome=ar.nome AND (p.unit_id=a.unit_id OR (p.unit_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.perguntas_processo own WHERE own.ativo AND own.area_nome=ar.nome AND own.unit_id=a.unit_id))) ORDER BY p.categoria,p.ordem,p.id LOOP
    expected:=expected+1;
    SELECT value INTO r FROM jsonb_array_elements(p_answers) WHERE value->>'pergunta_id'=q.id::text;
    IF r IS NULL OR COALESCE(r->>'resposta','') NOT IN ('SIM','NÃO','NA') THEN RAISE EXCEPTION 'Resposta inválida ou ausente: %',q.pergunta; END IF;
    fotos_q := CASE WHEN jsonb_typeof(r->'foto_urls')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'foto_urls')) WHEN NULLIF(r->>'foto_url','') IS NOT NULL THEN ARRAY[r->>'foto_url'] ELSE '{}'::text[] END;
    INSERT INTO public.respostas_processo(auditoria_processo_id,pergunta_id,resposta,observacao,foto_url,foto_urls) VALUES(p_id,q.id,r->>'resposta',r->>'observacao',fotos_q[1],fotos_q) ON CONFLICT(auditoria_processo_id,pergunta_id) DO UPDATE SET resposta=excluded.resposta,observacao=excluded.observacao,foto_url=excluded.foto_url,foto_urls=excluded.foto_urls;
    IF r->>'resposta'<>'NA' THEN
      IF q.categoria='Pessoas' THEN cp:=cp+1; IF r->>'resposta'='SIM' THEN sp:=sp+1; END IF;
      ELSIF q.categoria='Ambiente' THEN ca:=ca+1; IF r->>'resposta'='SIM' THEN sa:=sa+1; END IF;
      ELSE cpr:=cpr+1; IF r->>'resposta'='SIM' THEN spr:=spr+1; END IF; END IF;
    END IF;
  END LOOP;
  IF expected=0 OR expected<>jsonb_array_length(p_answers) THEN RAISE EXCEPTION 'O checklist mudou. Reabra a tela de edição.'; END IF;
  IF cp=0 OR ca=0 OR cpr=0 THEN RAISE EXCEPTION 'Cada pilar precisa de ao menos uma resposta SIM ou NÃO (não pode ter todas marcadas como N/A).'; END IF;
  np:=100.0*sp/cp; na:=100.0*sa/ca; npr:=100.0*spr/cpr;

  FOR action IN SELECT value FROM jsonb_array_elements(p_acoes) LOOP
    IF jsonb_typeof(action) IS DISTINCT FROM 'object' OR NULLIF(btrim(action->>'o_que'),'') IS NULL THEN
      RAISE EXCEPTION 'Informe o que será feito em cada ação.';
    END IF;
    IF action ? 'pergunta_id' AND action->>'pergunta_id' IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers) WHERE value->>'pergunta_id' = action->>'pergunta_id' AND value->>'resposta' = 'NÃO') THEN
        RAISE EXCEPTION 'Uma ação só pode ser vinculada a uma pergunta respondida como Não.';
      END IF;
    END IF;
    v_status := COALESCE(action->>'status','aberta');
    IF v_status NOT IN ('aberta','em_andamento','concluida','cancelada') THEN
      RAISE EXCEPTION 'Status de ação inválido: %', v_status;
    END IF;
    IF action ? 'id' AND action->>'id' IS NOT NULL THEN
      UPDATE public.acoes_processo
        SET pergunta_id = (action->>'pergunta_id')::uuid, o_que = action->>'o_que', como = action->>'como',
            responsavel_id = (action->>'responsavel_id')::uuid,
            prazo = (action->>'prazo')::date, status = v_status
        WHERE id = (action->>'id')::uuid AND auditoria_processo_id = p_id;
      IF FOUND THEN seen_ids := array_append(seen_ids, (action->>'id')::uuid); END IF;
    ELSE
      INSERT INTO public.acoes_processo(auditoria_processo_id,pergunta_id,o_que,como,responsavel_id,prazo,status)
      VALUES (p_id, (action->>'pergunta_id')::uuid, action->>'o_que', action->>'como', (action->>'responsavel_id')::uuid, (action->>'prazo')::date, v_status);
    END IF;
  END LOOP;
  DELETE FROM public.acoes_processo WHERE auditoria_processo_id = p_id AND pergunta_id IS NOT NULL AND id <> ALL(seen_ids);

  UPDATE public.auditorias_processo SET colaborador_auditado=x.colaborador_auditado,documento_referencia=x.documento_referencia,data_auditoria=COALESCE(x.data_auditoria,a.data_auditoria),turno=x.turno,nota_pessoas=np,nota_ambiente=na,nota_processo=npr,nota_final=(np+na+npr)/3,processo_claro=x.processo_claro,processo_claro_observacao=x.processo_claro_observacao,observacoes=x.observacoes
  FROM jsonb_populate_record(NULL::public.auditorias_processo,p_audit) x WHERE auditorias_processo.id=p_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Sem permissão para editar esta auditoria de processos.'; END IF;
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.evidence_owner(_path text)
 RETURNS TABLE(unit_id uuid, area_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $f$
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
$f$;