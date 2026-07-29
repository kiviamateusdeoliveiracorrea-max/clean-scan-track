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
import { Lightbulb, Plus, Trash2, Pencil, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { EvidenceThumbs } from "@/components/EvidenceThumbs";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadPhotos } from "@/lib/upload-photos";
import { useActiveUsers, useAreas } from "@/hooks/use-app-lookups";
import { useCurrentRole } from "@/hooks/use-current-role";

export const Route = createFileRoute("/_authenticated/melhorias")({
  component: MelhoriasPage,
});

const CATEGORIAS = ["Segurança", "Ergonomia", "Qualidade", "Processo", "Layout", "5S"];
const STATUS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
];

const statusColor: Record<string, string> = {
  aberto: "bg-amber-100 text-amber-800",
  em_andamento: "bg-blue-100 text-blue-800",
  concluido: "bg-emerald-100 text-emerald-800",
};

function MelhoriasPage() {
  const qc = useQueryClient();
  const { canResolveNC: podeEditar, canManageNC: podeExcluir } = useCurrentRole();
  const { data: areas = [] } = useAreas();
  const { data: users = [] } = useActiveUsers();

  const [filtro, setFiltro] = useState("todas");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [areaId, setAreaId] = useState("");
  const [processo, setProcesso] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Processo");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState("aberto");
  const [comentarios, setComentarios] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  const { data: itens = [] } = useQuery({
    queryKey: ["melhorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("melhorias")
        .select("*, areas(nome), responsavel:profiles!melhorias_responsavel_id_fkey(id,nome,cargo)")
        .order("data_identificacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = itens.filter((m: any) => filtro === "todas" || m.status === filtro);

  function reset() {
    setEditing(null);
    setAreaId("");
    setProcesso("");
    setData(new Date().toISOString().slice(0, 10));
    setDescricao("");
    setCategoria("Processo");
    setResponsavelId("");
    setPrazo("");
    setStatus("aberto");
    setComentarios("");
    setFotos([]);
  }

  function openNew() {
    reset();
    setOpen(true);
  }

  function openEdit(m: any) {
    setEditing(m);
    setAreaId(m.area_id ?? "");
    setProcesso(m.processo ?? "");
    setData(m.data_identificacao ?? "");
    setDescricao(m.descricao ?? "");
    setCategoria(m.categoria ?? "Processo");
    setResponsavelId(m.responsavel_id ?? "");
    setPrazo(m.prazo ?? "");
    setStatus(m.status ?? "aberto");
    setComentarios(m.comentarios ?? "");
    setFotos([]);
    setOpen(true);
  }

  async function save() {
    if (!descricao.trim()) return toast.error("Descreva a oportunidade");
    setSaving(true);
    try {
      const novas = await uploadPhotos(fotos, `melhorias/${editing?.id ?? "nova"}`);
      const payload: any = {
        area_id: areaId || null,
        processo: processo.trim() || null,
        data_identificacao: data || new Date().toISOString().slice(0, 10),
        descricao: descricao.trim(),
        categoria,
        responsavel_id: responsavelId || null,
        prazo: prazo || null,
        status,
        comentarios: comentarios.trim() || null,
      };
      if (editing) {
        payload.foto_urls = [...(editing.foto_urls ?? []), ...novas];
        const { error } = await supabase.from("melhorias").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.foto_urls = novas;
        payload.created_by = u.user?.id ?? null;
        const { error } = await supabase.from("melhorias").insert(payload);
        if (error) throw error;
      }
      toast.success(editing ? "Oportunidade atualizada" : "Oportunidade registrada");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["melhorias"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta oportunidade?")) return;
    const { error } = await supabase.from("melhorias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["melhorias"] });
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-accent" />
            Oportunidades de Melhoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {itens.filter((m: any) => m.status !== "concluido").length} em aberto ·{" "}
            {itens.filter((m: any) => m.status === "concluido").length} concluída(s)
          </p>
        </div>
        {podeEditar && (
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-1" /> Nova oportunidade
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {[{ value: "todas", label: "Todas" }, ...STATUS].map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filtro === f.value ? "default" : "outline"}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {lista.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma oportunidade registrada.
            </CardContent>
          </Card>
        )}
        {lista.map((m: any) => {
          const atrasada = m.prazo && m.prazo < hoje && m.status !== "concluido";
          return (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusColor[m.status] ?? ""}>
                        {STATUS.find((s) => s.value === m.status)?.label ?? m.status}
                      </Badge>
                      <Badge variant="outline">{m.categoria}</Badge>
                      {m.areas?.nome && <Badge variant="secondary">{m.areas.nome}</Badge>}
                      {atrasada && <Badge className="bg-red-100 text-red-700">Atrasada</Badge>}
                    </div>
                    <p className="font-medium text-foreground">{m.descricao}</p>
                    {m.processo && (
                      <p className="text-xs text-muted-foreground">Processo: {m.processo}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {podeEditar && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Identificada em{" "}
                    {new Date(m.data_identificacao + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  {m.prazo && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Prazo{" "}
                      {new Date(m.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {m.responsavel?.nome ?? "Sem responsável"}
                  </span>
                </div>
                {m.comentarios && (
                  <p className="text-sm bg-muted/40 rounded p-2">{m.comentarios}</p>
                )}
                {Array.isArray(m.foto_urls) && m.foto_urls.length > 0 && (
                  <EvidenceThumbs paths={m.foto_urls} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Área</Label>
                <Select value={areaId || "__none__"} onValueChange={(v) => setAreaId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem área —</SelectItem>
                    {areas.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Processo</Label>
                <Input value={processo} onChange={(e) => setProcesso(e.target.value)} />
              </div>
              <div>
                <Label>Data da identificação</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição da oportunidade *</Label>
              <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Responsável pela ação</Label>
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
                <Label>Data prevista para conclusão</Label>
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
            <div>
              <Label>Comentários</Label>
              <Textarea rows={2} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
            </div>
            <PhotoPicker label="Foto da evidência" files={fotos} onChange={setFotos} />
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
