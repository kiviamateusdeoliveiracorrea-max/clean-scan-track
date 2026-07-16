DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles admin insert'
  ) THEN
    CREATE POLICY "user_roles admin insert"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles admin update'
  ) THEN
    CREATE POLICY "user_roles admin update"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'administrador'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles admin delete'
  ) THEN
    CREATE POLICY "user_roles admin delete"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'administrador'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles admin update all'
  ) THEN
    CREATE POLICY "profiles admin update all"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'administrador'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));
  END IF;
END $$;