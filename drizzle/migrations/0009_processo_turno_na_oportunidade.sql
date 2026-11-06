ALTER TABLE public.auditorias_processo ADD COLUMN IF NOT EXISTS turno text CHECK (turno IN ('1º Turno','2º Turno'));
ALTER TABLE public.respostas_processo ADD COLUMN IF NOT EXISTS oportunidade_melhoria text;
ALTER TABLE public.respostas_processo DROP CONSTRAINT IF EXISTS respostas_processo_resposta_check;
ALTER TABLE public.respostas_processo ADD CONSTRAINT respostas_processo_resposta_check CHECK (resposta IN ('SIM','NÃO','NA'));
CREATE OR REPLACE FUNCTION public.complete_audit_processo(p_id uuid,p_audit jsonb,p_answers jsonb,p_acoes jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.auditorias_processo; r jsonb; q record; action jsonb; expected integer:=0; changed integer; np numeric; na numeric; npr numeric; cp integer:=0; ca integer:=0; cpr integer:=0; sp integer:=0; sa integer:=0; spr integer:=0;
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
INSERT INTO public.respostas_processo(auditoria_processo_id,pergunta_id,resposta,observacao,foto_url,oportunidade_melhoria) VALUES(p_id,q.id,r->>'resposta',r->>'observacao',r->>'foto_url',r->>'oportunidade_melhoria') ON CONFLICT(auditoria_processo_id,pergunta_id) DO UPDATE SET resposta=excluded.resposta,observacao=excluded.observacao,foto_url=excluded.foto_url,oportunidade_melhoria=excluded.oportunidade_melhoria;
IF r->>'resposta'<>'NA' THEN
IF q.categoria='Pessoas' THEN cp:=cp+1; IF r->>'resposta'='SIM' THEN sp:=sp+1; END IF;
ELSIF q.categoria='Ambiente' THEN ca:=ca+1; IF r->>'resposta'='SIM' THEN sa:=sa+1; END IF;
ELSE cpr:=cpr+1; IF r->>'resposta'='SIM' THEN spr:=spr+1; END IF; END IF;
END IF;
END LOOP;
IF expected=0 OR expected<>jsonb_array_length(p_answers) THEN RAISE EXCEPTION 'O checklist mudou ou não possui respostas válidas. Reabra a auditoria.'; END IF;
IF cp=0 OR ca=0 OR cpr=0 THEN RAISE EXCEPTION 'Cada pilar precisa de ao menos uma resposta SIM ou NÃO (não pode ter todas marcadas como N/A).'; END IF;
np:=100.0*sp/cp; na:=100.0*sa/ca; npr:=100.0*spr/cpr;
FOR action IN SELECT value FROM jsonb_array_elements(p_acoes) LOOP
IF jsonb_typeof(action) IS DISTINCT FROM 'object' OR NULLIF(btrim(action->>'o_que'),'') IS NULL THEN RAISE EXCEPTION 'Informe o que será feito em cada ação.'; END IF;
INSERT INTO public.acoes_processo(auditoria_processo_id,o_que,como,responsavel_id,prazo,status) VALUES(p_id,action->>'o_que',action->>'como',(action->>'responsavel_id')::uuid,(action->>'prazo')::date,COALESCE(action->>'status','aberta'));
END LOOP;
UPDATE public.auditorias_processo SET auditor_id=x.auditor_id,colaborador_auditado=x.colaborador_auditado,documento_referencia=x.documento_referencia,data_auditoria=COALESCE(x.data_auditoria,a.data_auditoria),turno=x.turno,nota_pessoas=np,nota_ambiente=na,nota_processo=npr,nota_final=(np+na+npr)/3,processo_claro=x.processo_claro,processo_claro_observacao=x.processo_claro_observacao,observacoes=x.observacoes,fotos=COALESCE(x.fotos,'{}'),status='concluida' FROM jsonb_populate_record(NULL::public.auditorias_processo,p_audit) x WHERE auditorias_processo.id=p_id;
GET DIAGNOSTICS changed=ROW_COUNT;
IF changed<>1 THEN RAISE EXCEPTION 'Sem permissão para concluir auditoria de processos.'; END IF;
RETURN p_id; END $$;