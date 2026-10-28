ALTER TABLE public.respostas_auditoria ADD CONSTRAINT respostas_auditoria_audit_question_unique UNIQUE (auditoria_id, pergunta_id);
CREATE OR REPLACE FUNCTION public.complete_audit(p_id uuid, p_audit jsonb, p_answers jsonb, p_ncs jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE a public.auditorias; r jsonb; q record; expected integer := 0; changed integer; nc jsonb;
BEGIN
 SELECT * INTO a FROM public.auditorias WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria indisponível ou sem permissão.'; END IF;
 IF a.status='concluida' THEN RETURN p_id; END IF;
 IF a.status <> 'rascunho' THEN RAISE EXCEPTION 'Somente rascunhos podem ser concluídos.'; END IF;
 IF (p_audit->>'area_id')::uuid IS DISTINCT FROM a.area_id THEN RAISE EXCEPTION 'A área do rascunho não pode ser alterada.'; END IF;
 FOR q IN SELECT p.id,p.pergunta FROM public.perguntas_auditoria p JOIN public.areas ar ON ar.id=a.area_id WHERE p.ativo AND p.area_nome=ar.nome AND (p.unit_id=a.unit_id OR (p.unit_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.perguntas_auditoria own WHERE own.ativo AND own.area_nome=ar.nome AND own.unit_id=a.unit_id))) LOOP
   expected := expected+1;
   SELECT value INTO r FROM jsonb_array_elements(p_answers) WHERE value->>'pergunta_id'=q.id::text;
   IF r IS NULL OR r->>'resposta' NOT IN ('SIM','NÃO') THEN RAISE EXCEPTION 'Resposta inválida ou ausente: %',q.pergunta; END IF;
   BEGIN
    INSERT INTO public.respostas_auditoria(auditoria_id,pergunta_id,resposta,observacao,foto_url) VALUES(p_id,q.id,r->>'resposta',r->>'observacao',r->>'foto_url') ON CONFLICT(auditoria_id,pergunta_id) DO UPDATE SET resposta=excluded.resposta,observacao=excluded.observacao,foto_url=excluded.foto_url;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Falha ao gravar pergunta "%": %',q.pergunta,SQLERRM; END;
 END LOOP;
 IF expected=0 OR expected<>jsonb_array_length(p_answers) THEN RAISE EXCEPTION 'O checklist mudou ou não possui respostas válidas. Reabra a auditoria.'; END IF;
 FOR nc IN SELECT value FROM jsonb_array_elements(p_ncs) LOOP
  INSERT INTO public.nao_conformidades(auditoria_id,area_id,criterio,descricao,severidade,status,plano_acao,responsavel,responsavel_nc_id,responsavel_acao_id,aprovador_id,prazo,foto_urls)
  SELECT p_id,a.area_id,x.criterio,x.descricao,x.severidade,x.status,x.plano_acao,x.responsavel,x.responsavel_nc_id,x.responsavel_acao_id,x.aprovador_id,x.prazo,COALESCE(x.foto_urls,'{}') FROM jsonb_populate_record(NULL::public.nao_conformidades,nc) x;
 END LOOP;
 UPDATE public.auditorias SET auditor_id=x.auditor_id,data_auditoria=x.data_auditoria,seiri=x.seiri,seiton=x.seiton,seiso=x.seiso,seiketsu=x.seiketsu,shitsuke=x.shitsuke,pontuacao_total=x.pontuacao_total,percentual=x.percentual,nota_pessoas=x.nota_pessoas,nota_ambiente=x.nota_ambiente,nota_processo=x.nota_processo,observacoes=x.observacoes,fotos=COALESCE(x.fotos,'{}'),status='concluida' FROM jsonb_populate_record(NULL::public.auditorias,p_audit) x WHERE auditorias.id=p_id;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Sem permissão para concluir auditoria.'; END IF;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_audit(uuid,jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_audit(uuid,jsonb,jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_new_audit_completion() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.status='concluida' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
  IF NOT EXISTS (SELECT 1 FROM public.respostas_auditoria WHERE auditoria_id=NEW.id) THEN RAISE EXCEPTION 'Não é permitido concluir auditoria sem respostas válidas.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_new_audit_completion BEFORE INSERT OR UPDATE OF status ON public.auditorias FOR EACH ROW EXECUTE FUNCTION public.validate_new_audit_completion();