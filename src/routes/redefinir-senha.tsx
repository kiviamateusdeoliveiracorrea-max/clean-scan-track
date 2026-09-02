import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/intralog-logo.png.asset.json";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("A confirmação não é igual à nova senha.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Senha redefinida. Entre com a nova senha.");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível redefinir a senha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="rounded-lg bg-white px-6 py-4 shadow-sm border border-border">
            <img src={logoAsset.url} alt="Intralog JSL" className="h-12 w-auto object-contain" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Definir nova senha</CardTitle>
          </CardHeader>
          <CardContent>
            {!pronto ? (
              <p className="text-sm text-muted-foreground">
                Abra esta página pelo link enviado ao seu e-mail. Se o link expirou, solicite uma
                nova recuperação na tela de login.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmacao">Confirmar nova senha</Label>
                  <Input
                    id="confirmacao"
                    type="password"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={salvando}>
                  {salvando ? "Salvando..." : "Redefinir senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
