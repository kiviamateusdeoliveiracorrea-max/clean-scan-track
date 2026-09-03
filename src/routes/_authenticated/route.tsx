import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("ativo, deve_alterar_senha")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && (profile as any).ativo === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { inactive: "1" } as any });
    }
    if (
      profile &&
      (profile as any).deve_alterar_senha === true &&
      location.pathname !== "/minha-conta"
    ) {
      throw redirect({ to: "/minha-conta", search: { trocar: "1" } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
