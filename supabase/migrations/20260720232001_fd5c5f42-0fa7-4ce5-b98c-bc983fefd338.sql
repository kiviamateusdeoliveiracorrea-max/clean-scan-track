
-- 1) audit-photos storage: restrict to authenticated
DROP POLICY IF EXISTS "Public read audit photos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload audit photos" ON storage.objects;
DROP POLICY IF EXISTS "Public update audit photos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete audit photos" ON storage.objects;

CREATE POLICY "Auth read audit photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'audit-photos');
CREATE POLICY "Auth upload audit photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "Auth update audit photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'audit-photos') WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "Auth delete audit photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'audit-photos');

-- 2) Drop responsavel_email column from nao_conformidades (redundant with responsavel_acao_id -> profiles)
ALTER TABLE public.nao_conformidades DROP COLUMN IF EXISTS responsavel_email;

-- 3) Restrict profiles.email column so only service_role can read it directly
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;

-- 4) Remove blanket read-all-authenticated policy on user_roles; own-row policy remains and
-- server code accesses via service role when it needs cross-user role data.
DROP POLICY IF EXISTS "user_roles read all authenticated" ON public.user_roles;
