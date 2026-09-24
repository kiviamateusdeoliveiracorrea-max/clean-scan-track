CREATE OR REPLACE FUNCTION public.set_admin_log_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF coalesce(current_setting('app.unit_correction', true),'') <> 'on' THEN NEW.unit_id := OLD.unit_id; END IF;
    RETURN NEW;
  END IF;
  IF NEW.target_user_id IS NOT NULL THEN
    SELECT unit_id INTO NEW.unit_id FROM public.user_unit_permissions
      WHERE user_id = NEW.target_user_id ORDER BY is_default_unit DESC, created_at LIMIT 1;
    IF NEW.unit_id IS NULL THEN RAISE EXCEPTION 'Ação sobre usuário sem unidade vinculada' USING ERRCODE = '23502'; END IF;
  ELSE
    NEW.unit_id := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_log_unit() FROM PUBLIC, anon, authenticated;