-- profiles: restrict authenticated readers to non-sensitive columns
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, nome, cargo, area_id, ativo, created_at, updated_at, deve_alterar_senha) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- user_roles: remove blanket read access
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
GRANT ALL ON public.user_roles TO service_role;