import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Footprints, Plus, Trash2, Pencil, User, Calendar, ThumbsUp, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { EvidenceThumbs } from "@/components/EvidenceThumbs";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadPhotos } from "@/lib/upload-photos";
import { useActiveUsers, useAreas } from "@/hooks/use-app-lookups";
import { useCurrentRole } from "@/hooks/use-current-role";

export const Route = createFileRoute("/_authenticated/gemba")({
  component: GembaPage,
});

const STATUS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
];

function GembaPage() {
  const qc = useQueryClient();
  const { canResolveNC: podeEditar, canManageNC: podeExcluir } = useCurrentRole();
  const { data: areas = [] } = useAreas();
  const { data: users = [] } = useActiveUsers();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [areaId, setAreaId] = useState("");
  const [dataVisita, setDataVisita] = useState(new Date().toISOString().slice(0, 10));
  const [participantes, setParticipantes] = useState("");
  const [pontoPositivo, setPontoPositivo] = useState("");
  const [oportunidade, setOportunidade] = useState("");
  const [acao, setAcao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState("aberto");
  const [fotosAntes, setFotosAntes] = useState<File[]>([]);
  const [fotosDepois, setFotosDepois] = useState<File[]>([]);

  const { data: itens = [] } = useQuery({
    queryKey: ["gemba"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gemba_visitas")
        .select(
          "*, areas(nome), responsavel:profiles!gemba_visitas_responsavel_id_fkey(id,nome,cargo)",
        )
        .order("data_visita", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function reset() {
    setEditing(null);
    setAreaId("");
    setDataVisita(new Date().toISOString().slice(0, 10));
    setParticipantes("");
    setPontoPositivo("");
    setOportunidade("");
    setAcao("");
    setResponsavelId("");
    setPrazo("");
    setStatus("aberto");
    setFotosAntes([]);
    setFotosDepois([]);
  }

  function openEdit(g: any) {
    setEditing(g);
    setAreaId(g.area_id ?? "");
    setDataVisita(g.data_visita ?? "");
    setParticipantes(g.participantes ?? "");
    setPontoPositivo(g.ponto_positivo ?? "");
    setOportunidade(g.oportunidade ?? "");
    setAcao(g.acao_definida ?? "");
    setResponsavelId(g.responsavel_id ?? "");
    setPrazo(g.prazo ?? "");
    setStatus(g.status ?? "aberto");
    setFotosAntes([]);
    setFotosDepois([]);
    setOpen(true);
  }

  async function save() {
    if (!areaId) return toast.error("Selecione a área visitada");
    setSaving(true);
    try {
      const antes = await uploadPhotos(fotosAntes, `gemba/${editing?.id ?? "nova"}/antes`);
      const depois = await uploadPhotos(fotosDepois, `gemba/${editing?.id ?? "nova"}/depois`);
      const payload: any = {
        area_id: areaId,
        data_visita: dataVisita || new Date().toISOString().slice(0, 10),
        participantes: participantes.trim() || null,
        ponto_positivo: pontoPositivo.trim() || null,
        oportunidade: oportunidade.trim() || null,
        acao_definida: acao.trim() || null,
        responsavel_id: responsavelId || null,
        prazo: prazo || null,
        status,
      };
      if (editing) {
        payload.foto_antes_urls = [...(editing.foto_antes_urls ?? []), ...antes];
        payload.foto_depois_urls = [...(editing.foto_depois_urls ?? []), ...depois];
        const { error } = await supabase.from("gemba_visitas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.foto_antes_urls = antes;
        payload.foto_depois_urls = depois;
        payload.created_by = u.user?.id ?? null;
        const { error } = await supabase.from("gemba_visitas").insert(payload);
        if (error) throw error;
      }
      toast.success("Registro salvo");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["gemba"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este registro de Gemba?")) return;
    const { error } = await supabase.from("gemba_visitas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["gemba"] });
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Footprints className="h-7 w-7 text-accent" />
            Registro de Gemba
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{itens.length} visita(s) registrada(s)</p>
        </div>
        {podeEditar && (
          <Button
            onClick={() => {
              reset();
              setOpen(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova visita
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {itens.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma visita registrada.
            </CardContent>
          </Card>
        )}
        {itens.map((g: any) => (
          <Card key={g.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{g.areas?.nome ?? "Sem área"}</Badge>
                    <Badge variant="outline">
                      {STATUS.find((s) => s.value === g.status)?.label ?? g.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(g.data_visita + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {g.participantes && (
                    <p className="text-xs text-muted-foreground">
                      Participantes: {g.participantes}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {podeEditar && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {podeExcluir && (
                    <Button size="sm" variant="ghost" onClick={() => remove(g.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {g.ponto_positivo && (
                  <div className="rounded border bg-emerald-50/60 p-2">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> Ponto positivo
                    </p>
                    <p>{g.ponto_positivo}</p>
                  </div>
                )}
                {g.oportunidade && (
                  <div className="rounded border bg-amber-50/60 p-2">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> Oportunidade
                    </p>
                    <p>{g.oportunidade}</p>
                  </div>
                )}
              </div>

              {g.acao_definida && (
                <div className="text-sm bg-muted/40 rounded p-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Ação definida</p>
                  {g.acao_definida}
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {g.responsavel?.nome ?? "Sem responsável"}
                </span>
                {g.prazo && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Prazo{" "}
                    {new Date(g.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.isArray(g.foto_antes_urls) && g.foto_antes_urls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Antes</p>
                    <EvidenceThumbs paths={g.foto_antes_urls} />
                  </div>
                )}
                {Array.isArray(g.foto_depois_urls) && g.foto_depois_urls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Depois</p>
                    <EvidenceThumbs paths={g.foto_depois_urls} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar visita Gemba" : "Nova visita Gemba"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Área visitada *</Label>
                <Select value={areaId || "__none__"} onValueChange={(v) => setAreaId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Selecione —</SelectItem>
                    {areas.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da visita</Label>
                <Input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Participantes</Label>
              <Input
                value={participantes}
                onChange={(e) => setParticipantes(e.target.value)}
                placeholder="Nomes separados por vírgula"
              />
            </div>
            <div>
              <Label>Ponto positivo identificado</Label>
              <Textarea rows={2} value={pontoPositivo} onChange={(e) => setPontoPositivo(e.target.value)} />
            </div>
            <div>
              <Label>Oportunidade de melhoria identificada</Label>
              <Textarea rows={2} value={oportunidade} onChange={(e) => setOportunidade(e.target.value)} />
            </div>
            <PhotoPicker label="Foto antes" files={fotosAntes} onChange={setFotosAntes} />
            <PhotoPicker label="Foto depois" files={fotosDepois} onChange={setFotosDepois} />
            <div>
              <Label>Ação definida</Label>
              <Textarea rows={2} value={acao} onChange={(e) => setAcao(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Label>Responsável</Label>
                <Select
                  value={responsavelId || "__none__"}
                  onValueChange={(v) => setResponsavelId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem responsável —</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome ?? "Sem nome"}
                        {u.cargo ? ` · ${u.cargo}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
