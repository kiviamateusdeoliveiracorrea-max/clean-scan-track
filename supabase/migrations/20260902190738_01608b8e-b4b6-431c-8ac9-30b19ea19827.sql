ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deve_alterar_senha boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  target_user_id uuid,
  target_user_nome text,
  target_user_email text,
  executado_por uuid,
  executado_por_nome text,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_select_admin" ON public.admin_logs;
CREATE POLICY "admin_logs_select_admin" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));