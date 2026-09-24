CREATE OR REPLACE FUNCTION public.set_unit_from_area() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_unit uuid; v_active boolean; v_parent uuid; v_aud uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND coalesce(current_setting('app.unit_correction', true),'') = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.unit_id IS DISTINCT FROM OLD.unit_id AND OLD.unit_id IS NOT NULL
     AND NEW.area_id IS NOT DISTINCT FROM OLD.area_id THEN
    RAISE EXCEPTION 'Alteração direta da unidade não é permitida' USING ERRCODE = '42501';
  END IF;

  IF NEW.area_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.area_id IS DISTINCT FROM OLD.area_id) THEN
    SELECT unit_id, active INTO v_unit, v_active FROM public.areas WHERE id = NEW.area_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Área inexistente' USING ERRCODE = '23503'; END IF;
    IF v_unit IS NULL THEN RAISE EXCEPTION 'Área sem unidade' USING ERRCODE = '23502'; END IF;
    IF TG_OP = 'INSERT' AND NOT v_active THEN RAISE EXCEPTION 'Área inativa' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' AND OLD.unit_id IS NOT NULL AND v_unit <> OLD.unit_id THEN
      RAISE EXCEPTION 'Não é permitido mover o registro para área de outra unidade' USING ERRCODE = '42501';
    END IF;
    NEW.unit_id := v_unit;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.unit_id := OLD.unit_id;
  ELSE
    NEW.unit_id := NULL;
  END IF;

  IF TG_TABLE_NAME IN ('nao_conformidades','auditorias_log') THEN
    v_aud := (to_jsonb(NEW)->>'auditoria_id')::uuid;
    IF v_aud IS NOT NULL THEN
      SELECT unit_id INTO v_parent FROM public.auditorias WHERE id = v_aud;
      IF NEW.unit_id IS NULL THEN NEW.unit_id := v_parent;
      ELSIF v_parent IS NOT NULL AND v_parent <> NEW.unit_id THEN
        RAISE EXCEPTION 'Auditoria e registro pertencem a unidades diferentes' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.unit_id IS NULL AND TG_TABLE_NAME <> 'auditorias_log' THEN
    RAISE EXCEPTION 'Registro sem unidade válida (informe uma área)' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_unit_from_area() FROM PUBLIC, anon, authenticated;