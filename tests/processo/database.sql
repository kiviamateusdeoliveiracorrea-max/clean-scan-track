\set ON_ERROR_STOP on
BEGIN;
-- Everything created by this suite is rolled back, including process overrides.
SELECT set_config('request.jwt.claim.sub', r.user_id::text, true)
FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id
WHERE r.role='administrador' AND p.ativo AND NOT p.excluido
AND EXISTS(SELECT 1 FROM public.user_unit_permissions u WHERE u.user_id=r.user_id AND u.active AND u.role='ADMIN_GLOBAL') LIMIT 1;
CREATE TEMP TABLE process_baseline AS SELECT
 (SELECT count(*) FROM public.auditorias) audits,
 (SELECT count(*) FROM public.respostas_auditoria) answers,
 (SELECT count(*) FROM public.nao_conformidades) ncs;
SET LOCAL ROLE authenticated;
DO $$
DECLARE ar public.areas; aid uuid; aid2 uuid; answers jsonb; payload jsonb; result public.auditorias_processo; qid uuid; failed boolean; before_count integer;
BEGIN
 SELECT * INTO ar FROM public.areas WHERE nome='CTT' AND public.user_has_unit_access(unit_id) AND public.user_has_area_access(id) LIMIT 1;
 IF ar.id IS NULL THEN RAISE EXCEPTION 'No authorized CTT test area'; END IF;
 IF (SELECT count(*) FROM public.perguntas_processo WHERE unit_id IS NULL)<>288 THEN RAISE EXCEPTION 'Expected 288 global questions'; END IF;
 IF has_function_privilege('anon','public.complete_audit_processo(uuid,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC execution allowed'; END IF;
 IF NOT has_function_privilege('authenticated','public.complete_audit_processo(uuid,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Authenticated RPC execution missing'; END IF;
 INSERT INTO public.auditorias_processo(area_id,unit_id) VALUES(ar.id,ar.unit_id) RETURNING id INTO aid;
 payload:=jsonb_build_object('area_id',ar.id,'unit_id',ar.unit_id,'processo_claro',false,'nota_final',0);
 SELECT jsonb_agg(jsonb_build_object('pergunta_id',id,'resposta','SIM')) INTO answers FROM public.perguntas_processo WHERE area_nome=ar.nome AND unit_id IS NULL AND ativo;
 PERFORM public.complete_audit_processo(aid,payload,answers,'[{"o_que":"Teste transacional","como":"Validar"}]');
 SELECT * INTO result FROM public.auditorias_processo WHERE id=aid;
 IF result.status<>'concluida' OR result.nota_final<>100 OR result.nota_pessoas<>100 OR result.nota_ambiente<>100 OR result.nota_processo<>100 OR result.processo_claro IS DISTINCT FROM false THEN RAISE EXCEPTION 'All SIM or closing exclusion failed'; END IF;
 IF (SELECT count(*) FROM public.respostas_processo WHERE auditoria_processo_id=aid)<>33 OR (SELECT count(*) FROM public.acoes_processo WHERE auditoria_processo_id=aid)<>1 THEN RAISE EXCEPTION 'Transactional writes failed'; END IF;
 PERFORM public.complete_audit_processo(aid,payload,answers,'[{"o_que":"Duplicate"}]');
 IF (SELECT count(*) FROM public.acoes_processo WHERE auditoria_processo_id=aid)<>1 THEN RAISE EXCEPTION 'Retry duplicated action'; END IF;
 RAISE NOTICE 'PASS: global checklist, 100%%, closing excluded, atomic writes, idempotent retry';
 INSERT INTO public.auditorias_processo(area_id,unit_id) VALUES(ar.id,ar.unit_id) RETURNING id INTO aid2;
 failed:=false;
 BEGIN UPDATE public.auditorias_processo SET status='concluida' WHERE id=aid2; EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Empty direct completion accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,answers-0,'[]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed OR EXISTS(SELECT 1 FROM public.respostas_processo WHERE auditoria_processo_id=aid2) THEN RAISE EXCEPTION 'Missing answers/rollback failed'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,answers || jsonb_build_array(answers->0),'[]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Duplicate answer accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,jsonb_set(answers,'{0,resposta}','"NA"'),'[]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'NA accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,jsonb_set(answers,'{0,resposta}','null'),'[]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Null answer accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,NULL,'[]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Malformed list accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.complete_audit_processo(aid2,payload,answers,'[{"o_que":"Valid"},{"o_que":""}]'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed OR EXISTS(SELECT 1 FROM public.respostas_processo WHERE auditoria_processo_id=aid2) OR EXISTS(SELECT 1 FROM public.acoes_processo WHERE auditoria_processo_id=aid2) THEN RAISE EXCEPTION 'Action failure rollback failed'; END IF;
 IF (SELECT status FROM public.auditorias_processo WHERE id=aid2)<>'rascunho' THEN RAISE EXCEPTION 'Failure changed draft'; END IF;
 RAISE NOTICE 'PASS: empty checklist, missing/duplicate/NA/null/malformed answers and action rollback';
 SELECT id INTO qid FROM public.perguntas_processo WHERE area_nome='CTT' AND categoria='Pessoas' AND unit_id IS NULL ORDER BY ordem LIMIT 1;
 -- An unequal weight must not affect the simple SIM percentages.
 UPDATE public.perguntas_processo SET peso=99 WHERE id=qid;
 SELECT jsonb_agg(jsonb_build_object('pergunta_id',id,'resposta',CASE WHEN id=qid THEN 'NÃO' ELSE 'SIM' END)) INTO answers FROM public.perguntas_processo WHERE area_nome=ar.nome AND unit_id IS NULL AND ativo;
 PERFORM public.complete_audit_processo(aid2,payload,answers,'[]');
 SELECT * INTO result FROM public.auditorias_processo WHERE id=aid2;
 IF abs(result.nota_pessoas-87.5)>0.000001 OR abs(result.nota_final-(87.5+100+100)/3)>0.000001 OR result.nota_final=100 THEN RAISE EXCEPTION 'Equal pillar average/unweighted score failed'; END IF;
 RAISE NOTICE 'PASS: NON conforming reduces score, unequal pillar counts average equally, peso ignored';
 -- Local questions replace all globals, not merge with them.
 INSERT INTO public.perguntas_processo(area_nome,categoria,ordem,pergunta,unit_id)
 VALUES(ar.nome,'Pessoas',1,'Teste local pessoas',ar.unit_id),(ar.nome,'Ambiente',1,'Teste local ambiente',ar.unit_id),(ar.nome,'Processo',1,'Teste local processo',ar.unit_id);
 INSERT INTO public.auditorias_processo(area_id,unit_id) VALUES(ar.id,ar.unit_id) RETURNING id INTO aid2;
 SELECT jsonb_agg(jsonb_build_object('pergunta_id',id,'resposta','SIM')) INTO answers FROM public.perguntas_processo WHERE area_nome=ar.nome AND unit_id=ar.unit_id AND ativo;
 PERFORM public.complete_audit_processo(aid2,payload,answers,'[]');
 IF (SELECT count(*) FROM public.respostas_processo WHERE auditoria_processo_id=aid2)<>3 THEN RAISE EXCEPTION 'Unit override failed'; END IF;
 RAISE NOTICE 'PASS: unit-specific checklist replaces global checklist';
 -- Change only the request identity, never user accounts or role records.
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM public.auditorias_processo) OR EXISTS(SELECT 1 FROM public.respostas_processo) OR EXISTS(SELECT 1 FROM public.acoes_processo) OR EXISTS(SELECT 1 FROM public.perguntas_processo) THEN RAISE EXCEPTION 'Unauthorized user can read'; END IF;
 failed:=false;
 BEGIN INSERT INTO public.auditorias_processo(area_id,unit_id) VALUES(ar.id,ar.unit_id); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unauthorized user can write'; END IF;
 RAISE NOTICE 'PASS: unauthorized identity cannot read or write any process table';
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM process_baseline WHERE audits<>(SELECT count(*) FROM public.auditorias) OR answers<>(SELECT count(*) FROM public.respostas_auditoria) OR ncs<>(SELECT count(*) FROM public.nao_conformidades)) THEN RAISE EXCEPTION '5S data changed'; END IF;
 RAISE NOTICE 'PASS: 5S records unchanged';
END $$;
ROLLBACK;
