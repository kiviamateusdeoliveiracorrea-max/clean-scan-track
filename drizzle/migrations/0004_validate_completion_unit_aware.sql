CREATE OR REPLACE FUNCTION public.validate_new_audit_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.status='concluida' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
  -- Só exige respostas quando a área possui perguntas ativas PARA A UNIDADE da auditoria
  -- (mesma regra de complete_audit: perguntas da unidade ou, na falta delas, as globais).
  -- Área sem perguntas permite concluir apenas com evidências e não conformidades.
  IF NOT EXISTS (SELECT 1 FROM public.respostas_auditoria WHERE auditoria_id=NEW.id)
     AND EXISTS (
       SELECT 1 FROM public.perguntas_auditoria p
       JOIN public.areas ar ON ar.id=NEW.area_id
       WHERE p.ativo AND p.area_nome=ar.nome
         AND (p.unit_id=NEW.unit_id OR (p.unit_id IS NULL AND NOT EXISTS (
           SELECT 1 FROM public.perguntas_auditoria own
           WHERE own.ativo AND own.area_nome=ar.nome AND own.unit_id=NEW.unit_id)))
     ) THEN
   RAISE EXCEPTION 'Não é permitido concluir auditoria sem respostas válidas.';
  END IF;
 END IF;
 RETURN NEW;
END $function$;