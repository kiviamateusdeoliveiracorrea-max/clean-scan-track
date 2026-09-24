import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnitPermissions, saveUnitPermission, UNIT_ROLES } from "@/lib/unit-permissions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

const PEND = "PENDENTE_DE_VALIDACAO";
const AREA_REQUIRED = ["LIDER", "COORDENADOR", "GERENTE", "CONSULTOR"];
const ALL = "__all";

type Row = any;

function fmt(d: string | null) {
  if (!d) return "nunca";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

function acaoNecessaria(r: Row) {
  if (!r.active) return "—";
  if (r.validation_status === "VALIDADO") return r.area_ids.length ? "Nenhuma" : "Revisar área";
  if (!r.role && !r.area_ids.length) return "Definir papel e área";
  if (!r.role) return "Definir papel";
  if (!r.area_ids.length) return "Definir área";
  return "Validar papel";
}

export function UnitPermissionsSection() {
  const qc = useQueryClient();
  const list = useServerFn(listUnitPermissions);
  const save = useServerFn(saveUnitPermission);
  const q = useQuery({
    queryKey: ["unit-permissions"],
    queryFn: async () => {
      try {
        return { ok: true as const, ...(await list()) };
      } catch (e) {
        const msg = (e as Error)?.message ?? "";
        if (msg.includes("Acesso negado")) return null;
        throw e;
      }
    },
    retry: false,
  });
  const [f, setF] = useState({ unit: ALL, oldRole: ALL, newRole: ALL, area: ALL, status: ALL, valid: ALL, semArea: false, adminPend: false, busca: "" });
  const [edit, setEdit] = useState<Row | null>(null);

  const data = q.data;
  const areaName = (id: string) => data?.areas.find((a: any) => a.id === id)?.nome ?? "—";
  const unitName = (id: string) => data?.units.find((u: any) => u.id === id)?.name ?? "—";
  const isAdminPend = (r: Row) =>
    r.active && r.validation_status !== "VALIDADO" && (r.papeis_globais.includes("administrador") || ["ADMIN_GLOBAL", "ADMIN_UNIDADE"].includes(r.role));

  const rows: Row[] = useMemo(() => {
    const all = data?.rows ?? [];
    return all.filter((r) => {
      if (f.unit !== ALL && r.unit_id !== f.unit) return false;
      if (f.oldRole !== ALL && !(f.oldRole === "none" ? r.papeis_globais.length === 0 : r.papeis_globais.includes(f.oldRole))) return false;
      if (f.newRole !== ALL && (f.newRole === PEND ? r.role : r.role !== f.newRole)) return false;
      if (f.area !== ALL && !r.area_ids.includes(f.area) && r.area_principal_id !== f.area) return false;
      if (f.status !== ALL && (f.status === "ativo") !== (r.active && r.conta_ativa)) return false;
      if (f.valid !== ALL && (f.valid === "VALIDADO") !== (r.validation_status === "VALIDADO")) return false;
      if (f.semArea && r.area_ids.length > 0) return false;
      if (f.adminPend && !isAdminPend(r)) return false;
      if (f.busca && !`${r.nome} ${r.email}`.toLowerCase().includes(f.busca.toLowerCase())) return false;
      return true;
    });
  }, [data, f]);

  if (q.isLoading) return <div className="p-4 text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando permissões…</div>;
  if (q.error) return <Card><CardContent className="pt-6 text-sm text-destructive">{(q.error as Error).message}</CardContent></Card>;
  if (!data) return null;

  const all = data.rows as Row[];
  const kpis = [
    ["Total de usuários", all.length],
    ["Papéis validados", all.filter((r) => r.validation_status === "VALIDADO").length],
    ["Papéis pendentes", all.filter((r) => r.active && r.validation_status !== "VALIDADO" && r.validation_status !== "INATIVO").length],
    ["Usuários sem área", all.filter((r) => r.active && r.area_ids.length === 0).length],
    ["Administradores pendentes", all.filter(isAdminPend).length],
    ["Usuários inativos", all.filter((r) => !r.active || !r.conta_ativa).length],
  ] as const;
  const adminsReview = all.filter(isAdminPend);

  const sel = (key: keyof typeof f, label: string, opts: [string, string][]) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={f[key] as string} onValueChange={(v) => setF({ ...f, [key]: v })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const renderRow = (r: Row) => (
    <div key={r.id} className="rounded-md border p-3 text-sm space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{r.nome || "—"}</p>
          <p className="text-xs text-muted-foreground">{r.email || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={r.conta_ativa ? "default" : "outline"}>{r.excluido ? "Excluído" : r.conta_ativa ? "Conta ativa" : "Conta inativa"}</Badge>
          <Badge variant={r.validation_status === "VALIDADO" ? "secondary" : "outline"}>{r.validation_status}</Badge>
          {r.active && r.area_ids.length === 0 && (
            <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Área pendente</Badge>
          )}
        </div>
      </div>
      <div className="grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Papel atual: <b className="text-foreground">{r.papeis_globais.join(", ") || "—"}</b></span>
        <span>Novo papel local: <b className="text-foreground">{r.role ?? PEND}</b></span>
        <span>Unidade: {unitName(r.unit_id)}{r.is_default_unit ? " (padrão)" : ""}</span>
        <span>Área principal: {r.area_principal_id ? areaName(r.area_principal_id) : "—"}</span>
        <span>Áreas autorizadas: {r.area_ids.map(areaName).join(", ") || "—"}</span>
        <span>Último acesso: {fmt(r.ultimo_acesso)}</span>
        <span>Ação necessária: <b className="text-foreground">{acaoNecessaria(r)}</b></span>
      </div>
      <div className="pt-1">
        <Button size="sm" variant="outline" disabled={r.user_id === data.me} onClick={() => setEdit(r)}>
          {r.user_id === data.me ? "Você não pode editar a si mesmo" : "Editar"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5" /> Permissões por Unidade</h2>
        <p className="text-sm text-muted-foreground">Classifique o papel local e as áreas de cada usuário. O papel atual não é alterado nesta etapa.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {kpis.map(([l, v]) => (
          <Card key={l}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Administradores para revisão ({adminsReview.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {adminsReview.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum administrador pendente.</p> : adminsReview.map(renderRow)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Usuários ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1 col-span-2 md:col-span-4"><Input placeholder="Buscar por nome ou e-mail" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} /></div>
            {sel("unit", "Unidade", data.units.map((u: any) => [u.id, u.name]))}
            {sel("oldRole", "Papel atual", [["administrador", "administrador"], ["gestor", "gestor"], ["auditor", "auditor"], ["consulta", "consulta"], ["none", "sem papel"]])}
            {sel("newRole", "Novo papel local", [...UNIT_ROLES.map((r) => [r, r] as [string, string]), [PEND, PEND]])}
            {sel("area", "Área", data.areas.map((a: any) => [a.id, a.nome]))}
            {sel("status", "Status", [["ativo", "Ativo"], ["inativo", "Inativo"]])}
            {sel("valid", "Validação", [["VALIDADO", "Validado"], ["PENDENTE", "Pendente"]])}
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={f.semArea} onCheckedChange={(v) => setF({ ...f, semArea: !!v })} /> Sem área</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={f.adminPend} onCheckedChange={(v) => setF({ ...f, adminPend: !!v })} /> Administrador pendente</label>
          </div>
          <div className="space-y-2">{rows.map(renderRow)}</div>
        </CardContent>
      </Card>

      {edit && (
        <EditDialog
          row={edit}
          isGlobal={data.isGlobal}
          areas={data.areas.filter((a: any) => a.unit_id === edit.unit_id)}
          unitName={unitName(edit.unit_id)}
          areaName={areaName}
          onClose={() => setEdit(null)}
          onSave={async (payload) => {
            try {
              const res = await save({ data: payload });
              toast.success(`Salvo. Situação: ${res.status}`);
              setEdit(null);
              qc.invalidateQueries({ queryKey: ["unit-permissions"] });
            } catch (e: any) {
              toast.error(e?.message ?? "Falha ao salvar");
            }
          }}
        />
      )}
    </div>
  );
}

function EditDialog({ row, isGlobal, areas, unitName, areaName, onClose, onSave }: {
  row: Row; isGlobal: boolean; areas: any[]; unitName: string; areaName: (id: string) => string;
  onClose: () => void; onSave: (p: any) => Promise<void>;
}) {
  const [role, setRole] = useState<string>(row.role ?? PEND);
  const [areaIds, setAreaIds] = useState<string[]>(row.area_ids);
  const [isDefault, setIsDefault] = useState<boolean>(row.is_default_unit);
  const [just, setJust] = useState("");
  const [obs, setObs] = useState(row.observation ?? "");
  const [busy, setBusy] = useState(false);
  const roleOpts = [...UNIT_ROLES.filter((r) => isGlobal || r !== "ADMIN_GLOBAL"), PEND];
  const lockedGlobal = !isGlobal && row.role === "ADMIN_GLOBAL";
  const needsArea = AREA_REQUIRED.includes(role) && areaIds.length === 0;

  const go = async (mode: "pending" | "validate" | "areas" | "deactivate") => {
    if (just.trim().length < 5) return toast.error("Informe a justificativa (mínimo 5 caracteres).");
    if (mode === "validate" && role === PEND) return toast.error("Selecione o papel local.");
    if (mode === "deactivate" && !confirm("Desativar o acesso deste usuário à unidade?")) return;
    setBusy(true);
    await onSave({ permissionId: row.id, mode, role: role === PEND ? null : role, areaIds, isDefault, justification: just, observation: obs });
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Permissão de {row.nome || "usuário"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>E-mail: {row.email || "—"}</p>
            <p>Papel atual (não muda): {row.papeis_globais.join(", ") || "—"}</p>
            <p>Unidade: {unitName}</p>
            <p>Área principal: {row.area_principal_id ? areaName(row.area_principal_id) : "—"}</p>
            <p>Acesso ativo: {row.active ? "Sim" : "Não"} · Situação: {row.validation_status}</p>
          </div>
          <div className="space-y-1">
            <Label>Novo papel na unidade</Label>
            <Select value={role} onValueChange={setRole} disabled={lockedGlobal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roleOpts.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            {lockedGlobal && <p className="text-xs text-destructive">Somente ADMIN_GLOBAL altera este papel.</p>}
          </div>
          <div className="space-y-1">
            <Label>Áreas autorizadas</Label>
            <div className="grid grid-cols-2 gap-1 rounded-md border p-2">
              {areas.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={areaIds.includes(a.id)} onCheckedChange={(v) => setAreaIds(v ? [...areaIds, a.id] : areaIds.filter((x) => x !== a.id))} />
                  {a.nome}
                </label>
              ))}
            </div>
            {needsArea && <p className="text-xs text-amber-700">Este papel exige área. Para validar sem área, detalhe a exceção na justificativa (mínimo 15 caracteres).</p>}
            {role === "ADMIN_UNIDADE" && areaIds.length === 0 && <p className="text-xs text-amber-700">Administrador da unidade sem área: permitido só na configuração inicial.</p>}
          </div>
          <label className="flex items-center gap-2"><Switch checked={isDefault} onCheckedChange={setIsDefault} /> Unidade padrão</label>
          <div className="space-y-1"><Label>Justificativa *</Label><Textarea value={just} onChange={(e) => setJust(e.target.value)} maxLength={1000} /></div>
          <div className="space-y-1"><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} /></div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="destructive" onClick={() => go("deactivate")} disabled={busy || lockedGlobal}>Desativar acesso</Button>
          <Button variant="outline" onClick={() => go("areas")} disabled={busy}>Atualizar áreas</Button>
          <Button variant="outline" onClick={() => go("pending")} disabled={busy || lockedGlobal}>Salvar como pendente</Button>
          <Button onClick={() => go("validate")} disabled={busy || lockedGlobal}>Validar papel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
