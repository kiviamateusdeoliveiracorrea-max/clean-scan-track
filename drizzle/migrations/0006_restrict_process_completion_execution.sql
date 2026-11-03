REVOKE ALL ON FUNCTION public.complete_audit_processo(uuid,jsonb,jsonb,jsonb) FROM anon,service_role;
GRANT EXECUTE ON FUNCTION public.complete_audit_processo(uuid,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_new_audit_processo_completion() FROM anon,authenticated,service_role;