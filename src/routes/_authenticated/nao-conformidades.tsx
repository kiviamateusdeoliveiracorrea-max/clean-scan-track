import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  Pencil,
  CheckCircle2,
  Camera,
  X,
  FileText,
  History,
} from "lucide-react";
import { STATUS_NC, SEVERIDADES } from "@/lib/audit-constants";
import { useCurrentRole } from "@/hooks/use-current-role";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nao-conformidades")({
  component: NCList,
});

function NCList() {
  const [status, setStatus] = useState<"pendentes" | "todos" | string>("pendentes");
  const [sev, setSev] = useState("todos");
  const [resp, setResp] = useState("todos");
  const { canManageNC, canResolveNC } = useCurrentRole();
  const qc = useQueryClient();

  // Edição de responsabilidade (admin/gestor)
  const [editing, setEditing] = useState<any | null>(null);
  const [editResp, setEditResp] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPrazo, setEditPrazo] = useState("");
  const [editStatus, setEditStatus] = useState("aberta");
  const [saving, setSaving] = useState(false);

  // Tratativa / conclusão
  const [resolving, setResolving] = useState<any | null>(null);
  const [planoAcao, setPlanoAcao] = useState("");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [acaoCorretiva, setAcaoCorretiva] = useState("");
  const [acaoPreventiva, setAcaoPreventiva] = useState("");
  const [novoStatus, setNovoStatus] = useState<string>("concluida");
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [resolveSaving, setResolveSaving] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["ncs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*, areas(nome), auditorias(data_auditoria, auditores(nome))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const auditoresQ = useQuery({
    queryKey: ["auditores"],
    enabled: canManageNC,
    queryFn: async () => {
      const { data, error } = await supabase.from("auditores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openEdit = (n: any) => {
    setEditing(n);
    setEditResp(n.responsavel ?? "");
    setEditEmail(n.responsavel_email ?? "");
    setEditPrazo(n.prazo ?? "");
    setEditStatus(n.status ?? "aberta");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("nao_conformidades")
      .update({
        responsavel: editResp.trim() || null,
        responsavel_email: editEmail.trim() || null,
        prazo: editPrazo || null,
        status: editStatus,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["ncs-all"] });
  };

  const openResolve = (n: any) => {
    setResolving(n);
    setPlanoAcao(n.plano_acao ?? "");
    setCausaRaiz(n.causa_raiz ?? "");
    setAcaoCorretiva(n.acao_corretiva ?? "");
    setAcaoPreventiva(n.acao_preventiva ?? "");
    setNovoStatus(n.status === "concluida" ? "concluida" : "concluida");
    setFotos([]);
    setDocs([]);
    fotosPreview.forEach((u) => URL.revokeObjectURL(u));
    setFotosPreview([]);
  };

  const closeResolve = () => {
    setResolving(null);
    setFotos([]);
    setDocs([]);
    fotosPreview.forEach((u) => URL.revokeObjectURL(u));
    setFotosPreview([]);
  };

  const onPickFoto = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setFotos((prev) => [...prev, ...arr]);
    setFotosPreview((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
  };

  const onPickDoc = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDocs((prev) => [...prev, ...Array.from(files)]);
  };

  const removeFoto = (idx: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
    setFotosPreview((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const removeDoc = (idx: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveResolve = async () => {
    if (!resolving) return;
    if (!planoAcao.trim()) {
      toast.error("Descreva o que foi realizado (tratativa).");
      return;
    }
    setResolveSaving(true);
    const uploadedPhotos: string[] = [];
    for (const f of fotos) {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${resolving.auditoria_id ?? "nc"}/tratativa-${resolving.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("audit-photos").upload(path, f);
      if (upErr) {
        setResolveSaving(false);
        return toast.error("Erro no upload: " + upErr.message);
      }
      uploadedPhotos.push(path);
    }
    const uploadedDocs: string[] = [];
    for (const f of docs) {
      const ext = f.name.split(".").pop() || "pdf";
      const path = `${resolving.auditoria_id ?? "nc"}/doc-${resolving.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("audit-photos")
        .upload(path, f, { contentType: f.type || undefined });
      if (upErr) {
        setResolveSaving(false);
        return toast.error("Erro no upload do documento: " + upErr.message);
      }
      uploadedDocs.push(path);
    }
    const existingPhotos: string[] = Array.isArray(resolving.foto_urls) ? resolving.foto_urls : [];
    const existingDocs: string[] = Array.isArray(resolving.documento_urls) ? resolving.documento_urls : [];
    const mergedPhotos = [...existingPhotos, ...uploadedPhotos];
    const mergedDocs = [...existingDocs, ...uploadedDocs];

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    const update: any = {
      plano_acao: planoAcao.trim(),
      causa_raiz: causaRaiz.trim() || null,
      acao_corretiva: acaoCorretiva.trim() || null,
      acao_preventiva: acaoPreventiva.trim() || null,
      status: novoStatus,
      updated_by: uid,
    };
    if (uploadedPhotos.length > 0) {
      update.foto_urls = mergedPhotos;
      if (!resolving.foto_url) update.foto_url = uploadedPhotos[0];
    }
    if (uploadedDocs.length > 0) update.documento_urls = mergedDocs;

    const { error } = await supabase.from("nao_conformidades").update(update).eq("id", resolving.id);
    if (error) {
      setResolveSaving(false);
      return toast.error(error.message);
    }

    // Histórico
    let userNome: string | null = null;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("nome").eq("id", uid).maybeSingle();
      userNome = (prof as any)?.nome ?? null;
    }
    await supabase.from("nc_historico").insert({
      nc_id: resolving.id,
      user_id: uid,
      user_nome: userNome,
      acao: novoStatus === "concluida" ? "Tratativa concluída" : "Tratativa atualizada",
      comentario: planoAcao.trim(),
    });

    setResolveSaving(false);
    toast.success("Tratativa registrada");
    closeResolve();
    qc.invalidateQueries({ queryKey: ["ncs-all"] });
    qc.invalidateQueries({ queryKey: ["nc-historico", resolving.id] });
  };


  const fotoPublicUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return supabase.storage.from("audit-photos").getPublicUrl(path).data.publicUrl;
  };

  const pendentes = data.filter(
    (n: any) => n.status === "aberta" || n.status === "em_andamento",
  );
  const responsaveis = Array.from(
    new Set(data.map((n: any) => n.responsavel).filter((r: any) => r && String(r).trim())),
  ).sort() as string[];
  const filtered = data.filter((n: any) => {
    if (status === "pendentes") {
      if (n.status !== "aberta" && n.status !== "em_andamento") return false;
    } else if (status !== "todos" && n.status !== status) return false;
    if (sev !== "todos" && n.severidade !== sev) return false;
    if (resp === "sem") {
      if (n.responsavel && String(n.responsavel).trim()) return false;
    } else if (resp !== "todos" && n.responsavel !== resp) return false;
    return true;
  });

  const sevColor: Record<string, string> = {
    baixa: "bg-slate-100 text-slate-700",
    media: "bg-blue-100 text-blue-700",
    alta: "bg-amber-100 text-amber-700",
    critica: "bg-red-100 text-red-700",
  };
  const statusColor: Record<string, string> = {
    aberta: "bg-red-100 text-red-700",
    em_andamento: "bg-amber-100 text-amber-700",
    concluida: "bg-emerald-100 text-emerald-700",
    cancelada: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-accent" />
          Não Conformidades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pendentes.length} pendente(s) · {data.length} no total
          {canManageNC && " · Você pode editar responsáveis e prazos"}
        </p>
      </header>

      {/* Indicadores por criticidade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["critica", "alta", "media", "baixa"] as const).map((s) => {
          const count = pendentes.filter((n: any) => n.severidade === s).length;
          const isCrit = s === "critica";
          const label = SEVERIDADES.find((x) => x.value === s)?.label ?? s;
          const cls = isCrit
            ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-400/40"
            : s === "alta"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : s === "media"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-700";
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSev(sev === s ? "todos" : s)}
              className={`text-left rounded-lg border p-3 transition hover:brightness-95 ${cls} ${
                sev === s ? "outline outline-2 outline-offset-1 outline-current" : ""
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                {label}
              </p>
              <p className="text-2xl md:text-3xl font-extrabold mt-1">{count}</p>
              <p className="text-[10px] opacity-70 mt-0.5">
                {isCrit ? "Ação imediata" : "Pendentes"}
              </p>
            </button>
          );
        })}
      </div>


      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Pendentes ({pendentes.length})</SelectItem>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_NC.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as severidades</SelectItem>
            {SEVERIDADES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma não conformidade encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n: any) => {
            const legacy = fotoPublicUrl(n.foto_url);
            const extras = Array.isArray(n.foto_urls)
              ? (n.foto_urls as string[]).map((p) => fotoPublicUrl(p)).filter(Boolean) as string[]
              : [];
            const allFotos = Array.from(new Set([...(legacy ? [legacy] : []), ...extras]));
            const isPend = n.status === "aberta" || n.status === "em_andamento";
            return (
              <Card
                key={n.id}
                className={`hover:border-accent transition-colors ${
                  n.severidade === "critica"
                    ? "border-red-400 border-l-4 border-l-red-500 bg-red-50/40"
                    : ""
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/auditorias/$id"
                      params={{ id: n.auditoria_id }}
                      className="flex-1 min-w-0 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${statusColor[n.status] ?? ""} border-0`}>
                          {STATUS_NC.find((s) => s.value === n.status)?.label ?? n.status}
                        </Badge>
                        <Badge className={`${sevColor[n.severidade] ?? ""} border-0`}>
                          {SEVERIDADES.find((s) => s.value === n.severidade)?.label ??
                            n.severidade}
                        </Badge>
                        <Badge variant="outline">{n.criterio}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            n.responsavel
                              ? "border-primary/40 text-primary bg-primary/5"
                              : "border-dashed text-muted-foreground"
                          }
                        >
                          <User className="h-3 w-3 mr-1" />
                          {n.responsavel || "Sem responsável"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{n.descricao}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {n.areas?.nome && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {n.areas.nome}
                          </span>
                        )}
                        {n.auditorias?.data_auditoria && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(n.auditorias.data_auditoria).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {n.prazo && (
                          <span>Prazo: {new Date(n.prazo).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-col gap-2 shrink-0">
                      {canResolveNC && isPend && (
                        <Button
                          size="sm"
                          onClick={() => openResolve(n)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Tratativa
                        </Button>
                      )}
                      {canResolveNC && !isPend && (n.plano_acao || allFotos.length > 0) && (
                        <Button variant="outline" size="sm" onClick={() => openResolve(n)}>
                          <Pencil className="h-3 w-3 mr-1" /> Tratativa
                        </Button>
                      )}
                      {canManageNC && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(n)}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                      )}
                    </div>
                  </div>

                  {(n.plano_acao || allFotos.length > 0) && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Tratativa realizada
                      </p>
                      {n.plano_acao && (
                        <p className="text-sm whitespace-pre-wrap">{n.plano_acao}</p>
                      )}
                      {allFotos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {allFotos.map((url, i) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img
                                src={url}
                                alt={`Foto da tratativa ${i + 1}`}
                                className="w-full aspect-square rounded-md border object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: editar responsabilidade */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar responsabilidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Responsável</Label>
              <Select
                value={editResp || undefined}
                onValueChange={(v) => {
                  setEditResp(v);
                  const a = (auditoresQ.data ?? []).find((x: any) => x.nome === v);
                  if (a?.email) setEditEmail(a.email);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(auditoresQ.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.nome}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input
                type="date"
                value={editPrazo}
                onChange={(e) => setEditPrazo(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_NC.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar tratativa / concluir */}
      <Dialog open={!!resolving} onOpenChange={(o) => !o && closeResolve()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar tratativa</DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <p className="font-medium">{resolving.criterio}</p>
                <p className="text-muted-foreground">{resolving.descricao}</p>
              </div>
              <div>
                <Label>O que foi realizado</Label>
                <Textarea
                  value={planoAcao}
                  onChange={(e) => setPlanoAcao(e.target.value)}
                  placeholder="Descreva a ação executada..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Fotos da tratativa (opcional — várias)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md aspect-square cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground">
                    <Camera className="h-6 w-6" />
                    <span>Tirar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        onPickFoto(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md aspect-square cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground">
                    <Camera className="h-6 w-6" />
                    <span>Galeria (múltiplas)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        onPickFoto(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {fotosPreview.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {fotosPreview.map((url, idx) => (
                      <div key={url} className="relative">
                        <img
                          src={url}
                          alt={`Preview ${idx + 1}`}
                          className="w-full aspect-square rounded-md border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFoto(idx)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                          aria-label="Remover foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {((Array.isArray(resolving.foto_urls) && resolving.foto_urls.length > 0) || resolving.foto_url) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Novas fotos serão adicionadas às já existentes.
                  </p>
                )}
              </div>

              <div>
                <Label>Documentos (PDF, opcional)</Label>
                <label className="mt-1 flex items-center gap-2 border-2 border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground">
                  <FileText className="h-5 w-5" />
                  <span>Anexar PDF ou imagens</span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      onPickDoc(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {docs.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {docs.map((d, i) => (
                      <li key={i} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1">
                        <span className="truncate flex-1 flex items-center gap-2">
                          <FileText className="h-3 w-3" /> {d.name}
                        </span>
                        <button type="button" onClick={() => removeDoc(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label>Causa raiz</Label>
                <Textarea value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} rows={2} placeholder="Por que ocorreu?" />
              </div>
              <div>
                <Label>Ação corretiva</Label>
                <Textarea value={acaoCorretiva} onChange={(e) => setAcaoCorretiva(e.target.value)} rows={2} placeholder="O que foi feito para corrigir." />
              </div>
              <div>
                <Label>Ação preventiva</Label>
                <Textarea value={acaoPreventiva} onChange={(e) => setAcaoPreventiva(e.target.value)} rows={2} placeholder="O que impede a reincidência." />
              </div>

              <div>
                <Label>Status após a tratativa</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_NC.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <HistoricoNC ncId={resolving.id} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeResolve}>
              Cancelar
            </Button>
            <Button
              onClick={saveResolve}
              disabled={resolveSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {resolveSaving ? "Salvando..." : "Registrar tratativa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoricoNC({ ncId }: { ncId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["nc-historico", ncId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nc_historico")
        .select("*")
        .eq("nc_id", ncId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (data.length === 0) return null;
  return (
    <div className="border-t pt-3 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
        <History className="h-3 w-3" /> Histórico
      </p>
      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {data.map((h: any) => (
          <li key={h.id} className="text-xs bg-muted/30 rounded p-2">
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span className="font-medium">{h.acao}</span>
              <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {h.user_nome && <div className="text-muted-foreground">por {h.user_nome}</div>}
            {h.comentario && <div className="mt-1 whitespace-pre-wrap">{h.comentario}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
