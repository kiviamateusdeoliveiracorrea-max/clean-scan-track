import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/intralog-logo.png.asset.json";
import { toast } from "sonner";
import { getLoginEmailCandidates, normalizeUserEmail } from "@/lib/email-normalization";

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
      const candidates = getLoginEmailCandidates(email);
      let lastError: Error | null = null;

      for (const candidate of candidates) {
        const { error } = await supabase.auth.signInWithPassword({
          email: candidate,
          password,
        });
        if (!error) {
          setEmail(normalizeUserEmail(candidate));
          toast.success("Bem-vindo!");
          navigate({ to: "/" });
          return;
        }

        lastError = error;
        if (!/invalid login credentials/i.test(error.message)) {
          throw error;
        }
      }

      throw lastError ?? new Error("E-mail ou senha inválidos");
    } catch (err: any) {
      toast.error(
        /invalid login credentials/i.test(err.message ?? "")
          ? "E-mail ou senha inválidos"
          : err.message ?? "Falha ao entrar",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="rounded-lg bg-white px-6 py-4 shadow-sm border border-border">
            <img
              src={logoAsset.url}
              alt="Intralog JSL"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Auditoria de Housekeeping Logístico
          </p>
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
                  onBlur={() => setEmail((value) => normalizeUserEmail(value))}
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
