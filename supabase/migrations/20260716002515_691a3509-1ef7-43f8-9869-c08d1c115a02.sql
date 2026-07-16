
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('administrador', 'auditor', 'gestor', 'consulta');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Tabela de papéis
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Função has_role (SECURITY DEFINER, evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger para criar profile + role default ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', '')::public.app_role,
      'consulta'::public.app_role
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at para profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Remover políticas públicas atuais e aplicar RLS por papel
DROP POLICY IF EXISTS "Public access areas" ON public.areas;
DROP POLICY IF EXISTS "Public access auditores" ON public.auditores;
DROP POLICY IF EXISTS "Public access auditorias" ON public.auditorias;
DROP POLICY IF EXISTS "Public access nc" ON public.nao_conformidades;

-- Leitura: todos autenticados
CREATE POLICY "areas read auth" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auditores read auth" ON public.auditores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auditorias read auth" ON public.auditorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "nc read auth" ON public.nao_conformidades FOR SELECT TO authenticated USING (true);

-- Áreas e auditores: escrita apenas admin
CREATE POLICY "areas admin write" ON public.areas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "areas admin update" ON public.areas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "areas admin delete" ON public.areas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "auditores admin write" ON public.auditores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "auditores admin update" ON public.auditores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "auditores admin delete" ON public.auditores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Auditorias: insert/update por admin ou auditor; delete por admin
CREATE POLICY "auditorias insert" ON public.auditorias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "auditorias update" ON public.auditorias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'auditor'))
  WITH CHECK (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "auditorias delete" ON public.auditorias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrador'));

-- Não conformidades: insert admin/auditor; update admin/auditor/gestor; delete admin
CREATE POLICY "nc insert" ON public.nao_conformidades FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "nc update" ON public.nao_conformidades FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'administrador')
    OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'gestor')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'administrador')
    OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'gestor')
  );
CREATE POLICY "nc delete" ON public.nao_conformidades FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrador'));
