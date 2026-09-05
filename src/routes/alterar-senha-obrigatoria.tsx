import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount, clearMustChangePassword } from "@/lib/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldAlert, Check, X } from "lucide-react";
import { passwordRules } from "@/lib/password-rules";
import logoAsset from "@/assets/intralog-logo.png.asset.json";

export const Route = createFileRoute("/alterar-senha-obrigatoria")({
  ssr: false,
  component: MandatoryPasswordChangePage,
});

function MandatoryPasswordChangePage() {
  const navigate = useNavigate();
  const [senhaTemporaria, setSenhaTemporaria] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setTemSessao(!!data.session);
      if (!data.session) navigate({ to: "/auth", replace: true });
    });
  }, [navigate]);

  const accountQ = useQuery({
    queryKey: ["my-account"],
    queryFn: () => getMyAccount(),
    enabled: temSessao === true,
  });

  const profile = accountQ.data?.profile as any;
  const email: string | null = profile?.email ?? null;
  const expiraEm = profile?.temporary_password_expires_at
    ? new Date(profile.temporary_password_expires_at)
    : null;
  const expirada = !!expiraEm && expiraEm.getTime() < Date.now();

  const regras = passwordRules(senha, email);
  const todasOk = regras.every((r) => r.ok);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!todasOk) {
      toast.error("A nova senha não atende aos requisitos.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("A confirmação não é igual à nova senha.");
      return;
    }
    if (senhaTemporaria && senha === senhaTemporaria) {
      toast.error("A nova senha não pode ser igual à senha temporária.");
      return;
    }
    setSalvando(true);
    try {
      const payload: any = { password: senha };
      if (senhaTemporaria) payload.current_password = senhaTemporaria;
      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;
      await clearMustChangePassword();
      await supabase.auth.signOut();
      toast.success("Senha alterada. Entre novamente com a nova senha.");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível alterar a senha.");
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
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" /> Criar nova senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expirada ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">
                  A senha temporária expirou. Solicite uma nova senha ao administrador.
                </p>
                <Button className="w-full" variant="outline" onClick={sair}>
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <p className="text-sm text-muted-foreground">
                  Sua senha foi redefinida por um administrador. Crie uma nova senha para
                  liberar o acesso ao aplicativo.
                  {expiraEm
                    ? ` Validade da senha temporária: ${expiraEm.toLocaleString("pt-BR")}.`
                    : ""}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="temp">Senha temporária recebida</Label>
                  <Input
                    id="temp"
                    type={mostrar ? "text" : "password"}
                    value={senhaTemporaria}
                    onChange={(e) => setSenhaTemporaria(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova">Nova senha</Label>
                  <Input
                    id="nova"
                    type={mostrar ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conf">Confirmar nova senha</Label>
                  <Input
                    id="conf"
                    type={mostrar ? "text" : "password"}
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrar((v) => !v)}
                >
                  {mostrar ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" /> Ocultar senhas
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" /> Mostrar senhas
                    </>
                  )}
                </Button>
                <ul className="space-y-1 text-xs">
                  {regras.map((r) => (
                    <li
                      key={r.label}
                      className={r.ok ? "text-emerald-600 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}
                    >
                      {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {r.label}
                    </li>
                  ))}
                </ul>
                <Button type="submit" className="w-full" disabled={salvando || !todasOk}>
                  {salvando ? "Salvando..." : "Salvar nova senha"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={sair}>
                  Sair
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
