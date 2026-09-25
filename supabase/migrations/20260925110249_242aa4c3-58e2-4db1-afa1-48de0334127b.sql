DROP POLICY IF EXISTS "Auth upload audit photos" ON storage.objects;
CREATE POLICY "Auth upload audit photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audit-photos' AND lower(storage.extension(name)) IN ('jpg','jpeg','jfif','png','webp','heic','pdf'));
DROP POLICY IF EXISTS "Auth update audit photos" ON storage.objects;
CREATE POLICY "Auth update audit photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'audit-photos')
WITH CHECK (bucket_id = 'audit-photos' AND lower(storage.extension(name)) IN ('jpg','jpeg','jfif','png','webp','heic','pdf'));

CREATE TABLE public.evidence_upload_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  context text NOT NULL,
  record_id uuid,
  paths text[] NOT NULL DEFAULT '{}',
  rollback_ok boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.evidence_upload_failures TO authenticated;
GRANT ALL ON public.evidence_upload_failures TO service_role;
ALTER TABLE public.evidence_upload_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own failure insert" ON public.evidence_upload_failures FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());