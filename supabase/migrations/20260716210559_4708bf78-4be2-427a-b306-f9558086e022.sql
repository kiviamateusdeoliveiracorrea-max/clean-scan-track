CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;
REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO service_role;

ALTER POLICY "areas admin delete" ON public.areas
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "areas admin update" ON public.areas
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "areas admin write" ON public.areas
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));

ALTER POLICY "auditores admin delete" ON public.auditores
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "auditores admin update" ON public.auditores
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "auditores admin write" ON public.auditores
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));

ALTER POLICY "auditorias delete" ON public.auditorias
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));
ALTER POLICY "auditorias insert" ON public.auditorias
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));
ALTER POLICY "auditorias update" ON public.auditorias
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));

ALTER POLICY "nc delete" ON public.nao_conformidades
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));
ALTER POLICY "nc insert" ON public.nao_conformidades
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));
ALTER POLICY "nc update" ON public.nao_conformidades
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));

ALTER POLICY "nc_historico insert auth" ON public.nc_historico
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role) OR app_private.has_role(auth.uid(), 'auditor'::public.app_role) OR app_private.has_role(auth.uid(), 'gestor'::public.app_role));

ALTER POLICY "profiles admin update all" ON public.profiles
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "profiles read own" ON public.profiles
  USING ((auth.uid() = id) OR app_private.has_role(auth.uid(), 'administrador'::public.app_role));

ALTER POLICY "user_roles admin delete" ON public.user_roles
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "user_roles admin insert" ON public.user_roles
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "user_roles admin read all" ON public.user_roles
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role));
ALTER POLICY "user_roles admin update" ON public.user_roles
  USING (app_private.has_role(auth.uid(), 'administrador'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'administrador'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM service_role;