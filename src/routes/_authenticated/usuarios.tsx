import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listUsers,
  createUser,
  setUserRole,
  deleteUser,
  type AppRole,
} from "@/lib/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, UserPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

const ROLE_LABEL: Record<AppRole, string> = {
  administrador: "Administrador",
  auditor: "Auditor",
  gestor: "Gestor",
  consulta: "Consulta",
};

const ROLE_OPTIONS: AppRole[] = ["administrador", "auditor", "gestor", "consulta"];

function UsuariosPage() {
  const qc = useQueryClient();
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("consulta");

  const createMut = useMutation({
    mutationFn: () => createUser({ data: { nome, email, password, role } }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setNome("");
      setEmail("");
      setPassword("");
      setRole("consulta");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar usuário"),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => setUserRole({ data: v }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const delMut = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie contas e permissões. Apenas administradores têm acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Novo usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (password.length < 8) {
                toast.error("Senha deve ter ao menos 8 caracteres");
                return;
              }
              createMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Criando..." : "Criar usuário"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const currentRole = (u.roles?.[0] as AppRole) ?? "consulta";
                return (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border rounded-md p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.nome || "(sem nome)"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ROLE_LABEL[currentRole]}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={currentRole}
                        onValueChange={(v) =>
                          roleMut.mutate({ userId: u.id, role: v as AppRole })
                        }
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Excluir ${u.email}?`)) delMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
