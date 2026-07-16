import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "administrador" | "auditor" | "gestor" | "consulta";

export function useCurrentRole() {
  const q = useQuery({
    queryKey: ["current-role"],
    queryFn: async (): Promise<AppRole | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const priority: AppRole[] = ["administrador", "gestor", "auditor", "consulta"];
      return priority.find((p) => roles.includes(p)) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const role = q.data ?? null;
  return {
    role,
    isAdmin: role === "administrador",
    isGestor: role === "gestor",
    canManageNC: role === "administrador" || role === "gestor",
    canResolveNC:
      role === "administrador" || role === "gestor" || role === "auditor",
    isLoading: q.isLoading,
  };
}
