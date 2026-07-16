import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listUsers,
  createUser,
  setUserRole,
  updateUserProfile,
  deleteUser,
  type AppRole,
} from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { normalizeUserEmail } from "@/lib/email-normalization";

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

  const areasQ = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("consulta");
  const [cargo, setCargo] = useState("");
  const [areaId, setAreaId] = useState<string>("");

  const createMut = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          nome,
          email,
          password,
          role,
          cargo: cargo.trim() || null,
          area_id: areaId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setNome(""); setEmail(""); setPassword(""); setRole("consulta");
      setCargo(""); setAreaId("");
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

  const updateMut = useMutation({
    mutationFn: (v: {
      userId: string;
      cargo?: string | null;
      area_id?: string | null;
      ativo?: boolean;
    }) => updateUserProfile({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
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
          Gerencie contas, cargos, áreas e permissões. Apenas administradores têm acesso.
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
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail corporativo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((v) => normalizeUserEmail(v))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Supervisor" />
            </div>
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(areasQ.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Perfil de acesso</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
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
              {users.map((u: any) => {
                const currentRole = (u.roles?.[0] as AppRole) ?? "consulta";
                const ativo = u.ativo !== false;
                return (
                  <div
                    key={u.id}
                    className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center border rounded-md p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {u.nome || "(sem nome)"}{" "}
                        {!ativo && (
                          <Badge variant="outline" className="ml-1 text-xs">Inativo</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.cargo || "—"} · {u.area_nome || "sem área"}
                      </p>
                    </div>
                    <Badge variant="secondary">{ROLE_LABEL[currentRole]}</Badge>
                    <Select
                      value={currentRole}
                      onValueChange={(v) => roleMut.mutate({ userId: u.id, role: v as AppRole })}
                    >
                      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Ativo</Label>
                      <Switch
                        checked={ativo}
                        onCheckedChange={(v) => updateMut.mutate({ userId: u.id, ativo: v })}
                      />
                    </div>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
