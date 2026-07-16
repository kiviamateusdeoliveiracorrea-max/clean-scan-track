import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Plus,
  Trash2,
  Camera,
  FileImage,
} from "lucide-react";
import {
  CRITERIOS_5S,
  SEVERIDADES,
  STATUS_NC,
  classificaPontuacao,
} from "@/lib/audit-constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias/$id")({
  component: AuditoriaDetail,
});

function AuditoriaDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: audit } = useQuery({
    queryKey: ["auditoria", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*, areas(nome, setor), auditores(nome)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["ncs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*")
        .eq("auditoria_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!audit) {
    return <div className="p-8">Carregando...</div>;
  }

  const scores = [
    { label: "Seiri", v: audit.seiri },
    { label: "Seiton", v: audit.seiton },
    { label: "Seiso", v: audit.seiso },
    { label: "Seiketsu", v: audit.seiketsu },
    { label: "Shitsuke", v: audit.shitsuke },
  ];
  const cls = classificaPontuacao(Number(audit.percentual));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/auditorias">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
              <MapPin className="h-6 w-6 text-accent" />
              {(audit as any).areas?.nome ?? "Sem área"}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(audit.data_auditoria).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {(audit as any).auditores?.nome ?? "—"}
              </span>
            </div>
          </div>
          <Badge className={`${cls.color} border-0 font-bold text-lg px-4 py-2`}>
            {Number(audit.percentual).toFixed(0)}% · {cls.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {scores.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs font-semibold text-accent uppercase">{s.label}</p>
              <p className="text-3xl font-bold text-primary mt-1">{s.v}</p>
              <p className="text-[10px] text-muted-foreground">/10</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {audit.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{audit.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {Array.isArray((audit as any).fotos) && (audit as any).fotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" /> Fotos da auditoria ({(audit as any).fotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditPhotos paths={(audit as any).fotos as string[]} />
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Não conformidades ({ncs.length})
          </CardTitle>
          <NovaNCDialog auditoriaId={id} areaId={audit.area_id} onCreated={() => qc.invalidateQueries({ queryKey: ["ncs", id] })} />
        </CardHeader>
        <CardContent>
          {ncs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma não conformidade registrada.
            </p>
          ) : (
            <div className="space-y-3">
              {ncs.map((nc: any) => (
                <NCItem
                  key={nc.id}
                  nc={nc}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["ncs", id] })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NCItem({ nc, onChanged }: { nc: any; onChanged: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const loadPhoto = async () => {
    if (!nc.foto_url || photoUrl) return;
    setLoadingUrl(true);
    const { data } = await supabase.storage
      .from("audit-photos")
      .createSignedUrl(nc.foto_url, 3600);
    setPhotoUrl(data?.signedUrl ?? null);
    setLoadingUrl(false);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta não conformidade?")) return;
    const { error } = await supabase.from("nao_conformidades").delete().eq("id", nc.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluída");
      onChanged();
    }
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase
      .from("nao_conformidades")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", nc.id);
    if (error) toast.error(error.message);
    else onChanged();
  };

  const sevColor: Record<string, string> = {
    baixa: "bg-slate-100 text-slate-700",
    media: "bg-blue-100 text-blue-700",
    alta: "bg-amber-100 text-amber-700",
    critica: "bg-red-100 text-red-700",
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline">{nc.criterio}</Badge>
            <Badge className={`${sevColor[nc.severidade] ?? ""} border-0`}>
              {SEVERIDADES.find((s) => s.value === nc.severidade)?.label ?? nc.severidade}
            </Badge>
          </div>
          <p className="text-sm font-medium">{nc.descricao}</p>
        </div>
        <button
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive p-1"
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {nc.foto_url && (
        <div>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Não conformidade"
              className="rounded-md max-h-64 object-cover"
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={loadPhoto}
              disabled={loadingUrl}
            >
              <FileImage className="h-4 w-4 mr-2" />
              {loadingUrl ? "Carregando..." : "Ver foto"}
            </Button>
          )}
        </div>
      )}

      {(nc.plano_acao || nc.responsavel || nc.prazo) && (
        <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
          {nc.plano_acao && (
            <p>
              <span className="font-semibold">Ação: </span>
              {nc.plano_acao}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {nc.responsavel && <span>Resp.: {nc.responsavel}{nc.responsavel_email ? ` (${nc.responsavel_email})` : ""}</span>}
            {nc.prazo && (
              <span>Prazo: {new Date(nc.prazo).toLocaleDateString("pt-BR")}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-xs">Status:</Label>
        <Select value={nc.status} onValueChange={updateStatus}>
          <SelectTrigger className="h-8 w-40">
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
  );
}

function NovaNCDialog({
  auditoriaId,
  areaId,
  onCreated,
}: {
  auditoriaId: string;
  areaId: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [criterio, setCriterio] = useState<string>(CRITERIOS_5S[0].nome);
  const [descricao, setDescricao] = useState("");
  const [severidade, setSeveridade] = useState("media");
  const [planoAcao, setPlanoAcao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [prazo, setPrazo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCriterio(CRITERIOS_5S[0].nome);
    setDescricao("");
    setSeveridade("media");
    setPlanoAcao("");
    setResponsavel("");
    setResponsavelEmail("");
    setPrazo("");
    setFile(null);
  };

  const handleSave = async () => {
    if (!descricao.trim()) {
      toast.error("Descreva a não conformidade");
      return;
    }
    if (responsavelEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responsavelEmail)) {
      toast.error("E-mail do responsável inválido");
      return;
    }
    setSaving(true);
    let foto_url: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${auditoriaId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("audit-photos")
        .upload(path, file);
      if (upErr) {
        toast.error("Erro no upload: " + upErr.message);
        setSaving(false);
        return;
      }
      foto_url = path;
    }
    const { error } = await supabase.from("nao_conformidades").insert({
      auditoria_id: auditoriaId,
      area_id: areaId,
      criterio,
      descricao,
      severidade,
      plano_acao: planoAcao || null,
      responsavel: responsavel || null,
      responsavel_email: responsavelEmail || null,
      prazo: prazo || null,
      foto_url,
      status: "aberta",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Não conformidade registrada");
    reset();
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-1" /> Nova NC
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar não conformidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Critério 5S</Label>
            <Select value={criterio} onValueChange={setCriterio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRITERIOS_5S.map((c) => (
                  <SelectItem key={c.key} value={c.nome}>
                    {c.nome} · {c.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a não conformidade..."
              rows={3}
            />
          </div>
          <div>
            <Label>Severidade</Label>
            <Select value={severidade} onValueChange={setSeveridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERIDADES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Foto</Label>
            <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm">
              <Camera className="h-4 w-4" />
              <span className="truncate">
                {file ? file.name : "Tirar / anexar foto"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-semibold text-primary">Plano de ação</p>
            <div>
              <Label>Ação corretiva</Label>
              <Textarea
                value={planoAcao}
                onChange={(e) => setPlanoAcao(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>E-mail do responsável</Label>
              <Input
                type="email"
                placeholder="responsavel@empresa.com"
                value={responsavelEmail}
                onChange={(e) => setResponsavelEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado para enviar notificações automáticas de prazo.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
