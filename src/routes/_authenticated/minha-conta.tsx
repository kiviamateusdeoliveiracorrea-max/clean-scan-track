import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount, clearMustChangePassword } from "@/lib/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, ShieldAlert, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    trocar: typeof search.trocar === "string" ? search.trocar : undefined,
  }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const search = useSearch({ from: "/_authenticated/minha-conta" }) as { trocar?: string };
  const accountQ = useQuery({ queryKey: ["my-account"], queryFn: () => getMyAccount() });

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const profile = accountQ.data?.profile as any;
  const roles = accountQ.data?.roles ?? [];
  const deveTrocar = profile?.deve_alterar_senha === true || search.trocar === "1";
  const regras = passwordRules(novaSenha, profile?.email ?? null);
  const todasOk = regras.every((r) => r.ok);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!todasOk) {
      toast.error("A nova senha não atende aos requisitos.");
      return;
    }
    if (novaSenha !== confirmacao) {
      toast.error("A confirmação não é igual à nova senha.");
      return;
    }
    if (novaSenha === senhaAtual) {
      toast.error("A nova senha deve ser diferente da senha atual.");
      return;
    }
    setSalvando(true);
    try {
      const email = profile?.email;
      if (email) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: senhaAtual,
        });
        if (authError) {
          toast.error("Senha atual incorreta.");
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      } as any);
      if (error) throw error;
      await clearMustChangePassword();
      setNovaSenha("");
      setConfirmacao("");
      setSenhaAtual("");
      await accountQ.refetch();
      toast.success("Senha alterada com sucesso. As outras sessões foram encerradas.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível alterar a senha.");
    } finally {
      setSalvando(false);
    }
  }


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <p className="text-sm text-muted-foreground">
          Consulte seus dados de acesso e altere sua senha.
        </p>
      </div>

      {deveTrocar && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Sua senha foi redefinida por um administrador. Crie uma nova senha para continuar
            usando o aplicativo.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="h-4 w-4" /> Meus dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Nome: </span>
            {profile?.nome || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">E-mail: </span>
            {profile?.email || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Cargo: </span>
            {profile?.cargo || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Área: </span>
            {profile?.areas?.nome || "—"}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-muted-foreground">Perfil:</span>
            {roles.length === 0 ? (
              <Badge variant="outline">—</Badge>
            ) : (
              roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r}
                </Badge>
              ))
            )}
            <Badge variant={profile?.ativo === false ? "outline" : "default"}>
              {profile?.ativo === false ? "Inativo" : "Ativo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleChangePassword}>
            {pedirSenhaAtual && (
              <div className="space-y-1.5">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
