import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveUser = {
  id: string;
  nome: string | null;
  cargo: string | null;
  areas?: { nome: string | null } | null;
};

export function useActiveUsers() {
  return useQuery({
    queryKey: ["usuarios-ativos"],
    queryFn: async (): Promise<ActiveUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo, areas(nome)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ActiveUser[];
    },
    staleTime: 60_000,
  });
}

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
