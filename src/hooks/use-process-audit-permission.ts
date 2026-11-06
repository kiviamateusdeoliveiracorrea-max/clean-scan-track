import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentRole } from "@/hooks/use-current-role";

/**
 * Quem pode editar/excluir auditorias de processo concluídas:
 * administrador/gestor sempre; auditor só quando é o auditor registrado (checado no banco).
 * Retorna uma função que responde para cada auditor_id.
 */
export function useProcessAuditManager(auditorIds: (string | null | undefined)[]) {
  const { role } = useCurrentRole();
  const ids = Array.from(new Set(auditorIds.filter(Boolean) as string[])).sort();
  const owned = useQuery({
    queryKey: ["processo-audit-owner", ids.join("|")],
    enabled: role === "auditor" && ids.length > 0,
    queryFn: async () => {
      const result: Record<string, boolean> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data } = await (supabase.rpc as any)("is_processo_audit_owner", { _auditor_id: id });
          result[id] = data === true;
        }),
      );
      return result;
    },
  });
  const can = (auditorId: string | null | undefined) =>
    role === "administrador" || role === "gestor" || (role === "auditor" && !!auditorId && !!owned.data?.[auditorId]);
  return Object.assign(can, { loading: owned.isLoading && owned.fetchStatus !== "idle" });
}
