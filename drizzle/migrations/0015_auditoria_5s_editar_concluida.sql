CREATE POLICY auditorias_concluida_update_guard ON public.auditorias
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    status <> 'concluida'
    OR app_private.has_role(auth.uid(),'administrador'::public.app_role)
    OR app_private.has_role(auth.uid(),'gestor'::public.app_role)
    OR public.is_processo_audit_owner(auditor_id)
  )
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.edit_completed_audit(p_id uuid, p_audit jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE a public.auditorias; changed integer;
BEGIN
  SELECT * INTO a FROM public.auditorias WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria indisponível ou sem permissão.'; END IF;
  IF a.status <> 'concluida' THEN RAISE EXCEPTION 'Somente auditorias concluídas podem ser editadas por aqui. Use a tela de preenchimento para rascunhos.'; END IF;
  IF jsonb_typeof(p_audit) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados inválidos.'; END IF;
  IF (p_audit->>'area_id')::uuid IS DISTINCT FROM a.area_id THEN RAISE EXCEPTION 'A área da auditoria não pode ser alterada.'; END IF;

  UPDATE public.auditorias SET
    auditor_id = x.auditor_id,
    data_auditoria = COALESCE(x.data_auditoria, a.data_auditoria),
    seiri = x.seiri, seiton = x.seiton, seiso = x.seiso, seiketsu = x.seiketsu, shitsuke = x.shitsuke,
    pontuacao_total = x.seiri + x.seiton + x.seiso + x.seiketsu + x.shitsuke,
    percentual = round(((x.seiri + x.seiton + x.seiso + x.seiketsu + x.shitsuke)::numeric / 50) * 100, 2),
    nota_pessoas = round(((x.seiri + x.seiton + x.seiso + x.seiketsu + x.shitsuke)::numeric / 50) * 100, 2),
    nota_ambiente = round(((x.seiri + x.seiton + x.seiso + x.seiketsu + x.shitsuke)::numeric / 50) * 100, 2),
    nota_processo = round(((x.seiri + x.seiton + x.seiso + x.seiketsu + x.shitsuke)::numeric / 50) * 100, 2),
    observacoes = x.observacoes
  FROM jsonb_populate_record(NULL::public.auditorias, p_audit) x
  WHERE auditorias.id = p_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Sem permissão para editar esta auditoria.'; END IF;
  RETURN p_id;
END $$;

REVOKE ALL ON FUNCTION public.edit_completed_audit(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_completed_audit(uuid, jsonb) TO authenticated;