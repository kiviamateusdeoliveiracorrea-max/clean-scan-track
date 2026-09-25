import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus, Copy, Pencil, Power, MapPin, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listUnits, createUnit, setUnitStatus, saveUnitArea, copyTemplateFromUnit, setUnitAdmin,
} from "@/lib/units.functions";

export const Route = createFileRoute("/_authenticated/unidades")({
  head: () => ({
    meta: [
      { title: "Unidades — AuditLog 5S" },
      { name: "description", content: "Cadastro e configuração das unidades, áreas e administradores locais." },
      { property: "og:title", content: "Unidades — AuditLog 5S" },
      { property: "og:description", content: "Cadastro e configuração das unidades, áreas e administradores locais." },
    ],
  }),
  component: UnidadesPage,
});

const STATUS_LABEL: Record<string, string> = { ATIVA: "Ativa", INATIVA: "Inativa", EM_CONFIGURACAO: "Em configuração" };
const empty = { code: "", name: "", company_name: "", city: "", state: "", observation: "", adminUserId: "" };

function UnidadesPage() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["units-admin"],
    queryFn: async () => {
      try { return await listUnits(); } catch (e: any) {
        if (String(e?.message).includes("Acesso negado")) return null;
        throw e;
      }
    },
    retry: false,
  });
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [statusDlg, setStatusDlg] = useState<{ unit: any; to: "ATIVA" | "INATIVA" } | null>(null);
  const [just, setJust] = useState("");
  const [areaDlg, setAreaDlg] = useState<{ unitId: string; area?: any } | null>(null);
  const [areaForm, setAreaForm] = useState({ nome: "", setor: "", descricao: "" });
  const [adminDlg, setAdminDlg] = useState<{ unitId: string } | null>(null);
  const [adminPick, setAdminPick] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["units-admin"] });
    qc.invalidateQueries({ queryKey: ["my-units"] });
    qc.invalidateQueries({ queryKey: ["areas"] });
  };

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">Erro ao carregar unidades.</div>;
  if (data === null || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <Card><CardContent className="py-10 text-center">
          <p className="font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">Somente ADMIN_GLOBAL pode gerenciar unidades.</p>
        </CardContent></Card>
      </div>
    );
  }

  const units = data.units as any[];
  const totalUsers = units.reduce((s, u) => s + u.users, 0);
  const totalAreas = units.reduce((s, u) => s + u.areas.length, 0);
  const lastUpdate = units.map((u) => u.updated_at).sort().at(-1);

  async function submitNew() {
    setSaving(true);
    try {
      const r = await createUnit({ data: { ...form, adminUserId: form.adminUserId || null } });
      if (!r.ok) return toast.error(r.error);
      toast.success("Unidade criada em configuração.");
      if ((r as any).warning) toast.warning((r as any).warning);
      setOpenNew(false); setForm(empty); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function submitStatus() {
    if (!statusDlg) return;
    const r = await setUnitStatus({ data: { unitId: statusDlg.unit.id, status: statusDlg.to, justification: just } });
    if (!r.ok) return toast.error(r.error);
    toast.success(statusDlg.to === "ATIVA" ? "Unidade ativada." : "Unidade inativada.");
    setStatusDlg(null); setJust(""); refresh();
  }

  async function submitArea() {
    if (!areaDlg) return;
    const r = await saveUnitArea({ data: { unitId: areaDlg.unitId, id: areaDlg.area?.id ?? null, ...areaForm } });
    if (!r.ok) return toast.error(r.error);
    toast.success(areaDlg.area ? "Área atualizada." : "Área criada.");
    setAreaDlg(null); refresh();
  }

  async function toggleArea(unitId: string, a: any) {
    const r = await saveUnitArea({ data: { unitId, id: a.id, nome: a.nome, setor: a.setor, descricao: a.descricao, active: !a.active } });
    if (!r.ok) return toast.error(r.error);
    toast.success(a.active ? "Área inativada." : "Área reativada.");
    refresh();
  }

  async function copyModel(unitId: string) {
    if (!confirm("Copiar da Motores somente perguntas/checklist e nomes das áreas? Auditorias, respostas, evidências, NCs, históricos e usuários NÃO serão copiados.")) return;
    const r = await copyTemplateFromUnit({ data: { targetUnitId: unitId, sourceCode: "MOT", copyAreas: true } });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Modelo copiado: ${r.perguntas} pergunta(s), ${r.areas} área(s).`);
    refresh();
  }

  async function submitAdmin() {
    if (!adminDlg || !adminPick) return;
    const r = await setUnitAdmin({ data: { unitId: adminDlg.unitId, userId: adminPick } });
    if (!r.ok) return toast.error(r.error);
    toast.success("Administrador da unidade definido.");
    setAdminDlg(null); setAdminPick(""); refresh();
  }

  const stat = (label: string, v: string | number) => (
    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold text-primary">{v}</p></CardContent></Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Configurações</p>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Building2 className="h-7 w-7 text-accent" /> Unidades
          </h1>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-1" /> Nova Unidade
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {stat("Total de unidades", units.length)}
        {stat("Ativas", units.filter((u) => u.status === "ATIVA").length)}
        {stat("Inativas", units.filter((u) => u.status === "INATIVA").length)}
        {stat("Usuários", totalUsers)}
        {stat("Áreas", totalAreas)}
        {stat("Última atualização", lastUpdate ? new Date(lastUpdate).toLocaleDateString("pt-BR") : "—")}
      </div>

      <div className="space-y-4">
        {units.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">{u.code} — {u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[u.company_name, [u.city, u.state].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs mt-1">
                    {u.users} usuário(s) · {u.areas.length} área(s) · Admin da unidade: {u.admins.length ? u.admins.join(", ") : "não definido"}
                  </p>
                  {u.observation && <p className="text-xs text-muted-foreground mt-1">{u.observation}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">Atualizada em {new Date(u.updated_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={u.status === "INATIVA" ? "destructive" : u.status === "ATIVA" ? "default" : "secondary"}>
                    {STATUS_LABEL[u.status] ?? u.status}
                  </Badge>
                  {u.code !== "MOT" && (
                    <Button size="sm" variant="outline" onClick={() => copyModel(u.id)}>
                      <Copy className="h-4 w-4 mr-1" /> Criar usando modelo da Motores
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setAdminDlg({ unitId: u.id }); setAdminPick(""); }}>
                    <UserCog className="h-4 w-4 mr-1" /> Definir admin
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAreaDlg({ unitId: u.id }); setAreaForm({ nome: "", setor: "", descricao: "" }); }}>
                    <MapPin className="h-4 w-4 mr-1" /> Nova área
                  </Button>
                  {u.status !== "ATIVA" && (
                    <Button size="sm" onClick={() => { setStatusDlg({ unit: u, to: "ATIVA" }); setJust(""); }}>
                      <Power className="h-4 w-4 mr-1" /> Ativar
                    </Button>
                  )}
                  {u.status !== "INATIVA" && (
                    <Button size="sm" variant="destructive" onClick={() => { setStatusDlg({ unit: u, to: "INATIVA" }); setJust(""); }}>
                      <Power className="h-4 w-4 mr-1" /> Inativar
                    </Button>
                  )}
                </div>
              </div>
              {u.areas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {u.areas.map((a: any) => (
                    <span key={a.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${a.active ? "" : "opacity-50 line-through"}`}>
                      {a.nome}
                      <button aria-label={`Editar ${a.nome}`} onClick={() => { setAreaDlg({ unitId: u.id, area: a }); setAreaForm({ nome: a.nome, setor: a.setor ?? "", descricao: a.descricao ?? "" }); }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button aria-label={a.active ? `Inativar ${a.nome}` : `Reativar ${a.nome}`} onClick={() => toggleArea(u.id, a)}>
                        <Power className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: BLC" /></div>
            <div><Label>Status</Label><Input value="Em configuração" readOnly /></div>
            <div className="col-span-2"><Label>Nome da unidade *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Empresa</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Estado (UF)</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Administrador da unidade</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.adminUserId} onChange={(e) => setForm({ ...form, adminUserId: e.target.value })}>
                <option value="">Definir depois</option>
                {data.profiles.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button disabled={saving || !form.code.trim() || !form.name.trim()} onClick={submitNew}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusDlg} onOpenChange={(o) => !o && setStatusDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{statusDlg?.to === "ATIVA" ? "Ativar" : "Inativar"} {statusDlg?.unit.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A unidade não é excluída. Os registros permanecem guardados.</p>
          <Label>Justificativa *</Label>
          <Textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDlg(null)}>Cancelar</Button>
            <Button disabled={just.trim().length < 5} onClick={submitStatus}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!areaDlg} onOpenChange={(o) => !o && setAreaDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{areaDlg?.area ? "Editar área" : "Nova área"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={areaForm.nome} onChange={(e) => setAreaForm({ ...areaForm, nome: e.target.value })} /></div>
            <div><Label>Setor</Label><Input value={areaForm.setor} onChange={(e) => setAreaForm({ ...areaForm, setor: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={areaForm.descricao} onChange={(e) => setAreaForm({ ...areaForm, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDlg(null)}>Cancelar</Button>
            <Button disabled={areaForm.nome.trim().length < 2} onClick={submitArea}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminDlg} onOpenChange={(o) => !o && setAdminDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Definir administrador da unidade</DialogTitle></DialogHeader>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={adminPick} onChange={(e) => setAdminPick(e.target.value)}>
            <option value="">Selecione…</option>
            {data.profiles.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">O usuário recebe ADMIN_UNIDADE somente nesta unidade. Os demais vínculos não mudam.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDlg(null)}>Cancelar</Button>
            <Button disabled={!adminPick} onClick={submitAdmin}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
