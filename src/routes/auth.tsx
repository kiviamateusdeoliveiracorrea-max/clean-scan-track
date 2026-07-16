import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">AuditLog 5S</p>
            <p className="text-xs text-muted-foreground">Auditoria de Housekeeping Logístico</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Novas contas são criadas por um administrador na tela de Usuários.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
