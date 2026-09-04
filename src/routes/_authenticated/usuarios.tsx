import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listUsers,
  createUser,
  setUserRole,
  updateUserProfile,
  adminSendPasswordReset,
  adminSetTemporaryPassword,
  setUserActive,
  getUserLinkedRecords,
  deleteUserPermanently,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, UserPlus, Loader2, Lock, Pencil, KeyRound, UserX } from "lucide-react";
import { normalizeUserEmail } from "@/lib/email-normalization";
import { useCurrentRole } from "@/hooks/use-current-role";

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

type StatusFilter = "ativos" | "inativos" | "todos";

type EditingUser = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  area_id: string;
  role: AppRole;
  ativo: boolean;
};

function UsuariosPage() {
  const qc = useQueryClient();
  const { canManageUsers, isAdmin, isLoading: roleLoading } = useCurrentRole();
  const [status, setStatus] = useState<StatusFilter>("ativos");

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users", status],
    queryFn: () => listUsers({ data: { status } }),
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

  const [editing, setEditing] = useState<EditingUser | null>(null);
  const [resetting, setResetting] = useState<{ id: string; nome: string; email: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<{ id: string; nome: string; email: string } | null>(
    null,
  );
  const [tempPass, setTempPass] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

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
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar usuário"),
  });




  const delMut = useMutation({
    mutationFn: (userId: string) => deleteUserPermanently({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído. Histórico preservado.");
      setDeleting(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao excluir usuário"),
  });

  const activeMut = useMutation({
    mutationFn: (p: { userId: string; ativo: boolean }) => setUserActive({ data: p }),
    onSuccess: (_d, p) => {
      toast.success(p.ativo ? "Usuário reativado" : "Usuário desativado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao alterar status"),
  });

  const resetLinkMut = useMutation({
    mutationFn: (userId: string) =>
      adminSendPasswordReset({
        data: { userId, redirectTo: `${window.location.origin}/redefinir-senha` },
      }),
    onSuccess: () => {
      toast.success("Link de recuperação enviado ao e-mail do usuário.");
      setResetting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar link"),
  });

  const tempPassMut = useMutation({
    mutationFn: (p: { userId: string; password: string }) =>
      adminSetTemporaryPassword({ data: p }),
    onSuccess: () => {
      toast.success("Senha temporária definida. O usuário deverá trocá-la no próximo acesso.");
      setResetting(null);
      setTempPass("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao definir senha temporária"),
  });

  const linkedQ = useQuery({
    queryKey: ["user-linked", deleting?.id],
    queryFn: () => getUserLinkedRecords({ data: { userId: deleting!.id } }),
    enabled: !!deleting,
  });

  const saveEdit = useMutation({
    mutationFn: async (u: EditingUser) => {
      const orig = users?.find((x: any) => x.id === u.id);
      const patch: any = { userId: u.id };
      if (u.nome !== (orig?.nome ?? "")) patch.nome = u.nome;
      if (u.email && u.email !== (orig?.email ?? "")) patch.email = u.email;
      if ((u.cargo || null) !== (orig?.cargo ?? null)) patch.cargo = u.cargo.trim() || null;
      if ((u.area_id || null) !== (orig?.area_id ?? null)) patch.area_id = u.area_id || null;
      if (u.ativo !== (orig?.ativo ?? true)) patch.ativo = u.ativo;
      if (Object.keys(patch).length > 1) {
        await updateUserProfile({ data: patch });
      }
      const currentRole = (orig?.roles?.[0] as AppRole) ?? "consulta";
      if (u.role !== currentRole) {
        await setUserRole({ data: { userId: u.id, role: u.role } });
      }
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
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
          {canManageUsers
            ? "Gerencie contas, cargos, áreas e permissões. Apenas administradores e gestores podem alterar cadastros."
            : "Consulta de usuários cadastrados. Apenas administradores e gestores podem realizar alterações."}
        </p>
        {!canManageUsers && !roleLoading && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Acesso somente leitura. Solicite a um administrador ou gestor para criar, editar,
              alterar perfis ou excluir usuários.
            </span>
          </div>
        )}
      </div>

      {canManageUsers && (
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
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Usuários cadastrados</CardTitle>
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="inativos">Inativos</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u: any) => {
                const currentRole = (u.roles?.[0] as AppRole) ?? "consulta";
                const ativo = u.ativo !== false;
                return (
                  <div
                    key={u.id}
                    className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center border rounded-md p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {u.nome || "(sem nome)"}{" "}
                        <Badge
                          variant={ativo ? "secondary" : "outline"}
                          className="ml-1 text-xs"
                        >
                          {ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        {u.deve_alterar_senha && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Troca de senha pendente
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.cargo || "—"} · {u.area_nome || "sem área"}
                        {u.created_at
                          ? ` · criado em ${new Date(u.created_at).toLocaleDateString("pt-BR")}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{ROLE_LABEL[currentRole]}</Badge>
                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {canManageUsers && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditing({
                              id: u.id,
                              nome: u.nome ?? "",
                              email: u.email ?? "",
                              cargo: u.cargo ?? "",
                              area_id: u.area_id ?? "",
                              role: currentRole,
                              ativo,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setResetting({
                                id: u.id,
                                nome: u.nome ?? "",
                                email: u.email ?? "",
                              })
                            }
                          >
                            <KeyRound className="h-4 w-4 mr-1" /> Redefinir senha
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activeMut.isPending}
                            onClick={() =>
                              activeMut.mutate({ userId: u.id, ativo: !ativo })
                            }
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            {ativo ? "Desativar" : "Reativar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir usuário"
                            onClick={() =>
                              setDeleting({
                                id: u.id,
                                nome: u.nome ?? "",
                                email: u.email ?? "",
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {!canManageUsers && !isAdmin && (
                        <span className="text-xs text-muted-foreground">Somente leitura</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit.mutate(editing);
              }}
            >
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  onBlur={() =>
                    setEditing((s) => (s ? { ...s, email: normalizeUserEmail(s.email) } : s))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={editing.cargo}
                  onChange={(e) => setEditing({ ...editing, cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Select
                  value={editing.area_id}
                  onValueChange={(v) => setEditing({ ...editing, area_id: v })}
                >
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
                <Label>Perfil de acesso</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as AppRole })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.ativo}
                  onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
                />
                <Label>{editing.ativo ? "Ativo" : "Inativo"}</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveEdit.isPending}>
                  {saveEdit.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Geração administrativa de senha temporária */}
      <Dialog
        open={!!resetting}
        onOpenChange={(o) => {
          if (!o) {
            setResetting(null);
            setJustificativa("");
            setConfirmarAdmin(false);
            setGerada(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {gerada ? "Senha temporária criada com sucesso" : "Gerar senha temporária"}
            </DialogTitle>
          </DialogHeader>
          {resetting && !gerada && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium">{resetting.nome || "(sem nome)"}</p>
                <p className="text-muted-foreground">{resetting.email || "sem e-mail"}</p>
                <p className="text-muted-foreground">Perfil: {resetting.perfil}</p>
                <p className="text-muted-foreground">
                  Áreas autorizadas: {resetting.area || "sem área"}
                </p>
                <p className="text-muted-foreground">
                  Status da conta: {resetting.ativo ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                A senha atual será substituída e todas as sessões do usuário serão encerradas.
                A senha temporária deverá ser alterada no primeiro acesso.
              </div>
              <div className="space-y-1.5">
                <Label>Justificativa (obrigatória)</Label>
                <Input
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Ex.: usuário esqueceu a senha e solicitou apoio"
                />
                <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres.</p>
              </div>
              {resetting.perfil === ROLE_LABEL.administrador && (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmarAdmin}
                    onChange={(e) => setConfirmarAdmin(e.target.checked)}
                  />
                  <span>
                    Confirmo a redefinição de senha de outro administrador (pode ser o último
                    administrador ativo).
                  </span>
                </label>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetting(null)}>
                  Cancelar
                </Button>
                <Button
                  disabled={tempPassMut.isPending}
                  onClick={() => {
                    if (justificativa.trim().length < 10) {
                      toast.error("Informe uma justificativa com ao menos 10 caracteres.");
                      return;
                    }
                    tempPassMut.mutate({
                      userId: resetting.id,
                      justificativa: justificativa.trim(),
                      confirmarAdmin,
                    });
                  }}
                >
                  {tempPassMut.isPending ? "Gerando..." : "Gerar senha temporária"}
                </Button>
              </DialogFooter>
            </div>
          )}
          {gerada && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Login: </span>
                  {gerada.login || "—"}
                </p>
                <p className="font-mono text-base break-all">{gerada.password}</p>
                <p className="text-xs text-muted-foreground">
                  Validade: {new Date(gerada.expiresAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Copie a senha agora. Por segurança, ela não poderá ser consultada novamente.
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(gerada.password);
                      toast.success("Senha copiada.");
                    } catch {
                      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
                    }
                  }}
                >
                  Copiar senha
                </Button>
                <Button
                  onClick={() => {
                    setGerada(null);
                    setResetting(null);
                    setJustificativa("");
                    setConfirmarAdmin(false);
                  }}
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Exclusão de usuário */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
          </DialogHeader>
          {deleting && (
            <div className="space-y-4">
              <p className="text-sm">
                Tem certeza de que deseja excluir este usuário? O acesso será removido.
              </p>
              <p className="text-sm text-muted-foreground">
                {deleting.nome || "(sem nome)"} · {deleting.email || "sem e-mail"}
              </p>
              <div className="rounded-md border p-3 text-xs space-y-1">
                {linkedQ.isLoading ? (
                  <span className="text-muted-foreground">Verificando registros vinculados…</span>
                ) : (
                  <>
                    <p className="font-medium">
                      Registros vinculados: {linkedQ.data?.total ?? 0}
                    </p>
                    <p className="text-muted-foreground">
                      O histórico de auditorias e tratativas é preservado. A referência passa a
                      exibir “Usuário excluído”.
                    </p>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleting(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  disabled={activeMut.isPending}
                  onClick={() => {
                    activeMut.mutate({ userId: deleting.id, ativo: false });
                    setDeleting(null);
                  }}
                >
                  Apenas desativar
                </Button>
                <Button
                  variant="destructive"
                  disabled={delMut.isPending}
                  onClick={() => delMut.mutate(deleting.id)}
                >
                  {delMut.isPending ? "Excluindo..." : "Excluir definitivamente"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
