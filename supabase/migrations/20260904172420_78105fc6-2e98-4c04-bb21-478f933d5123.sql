ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temporary_password_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS temporary_password_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_required_by uuid,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;