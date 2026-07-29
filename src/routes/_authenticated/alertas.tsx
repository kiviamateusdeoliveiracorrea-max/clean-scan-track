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
import { Megaphone, Plus, Trash2, Pencil, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { EvidenceThumbs } from "@/components/EvidenceThumbs";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadPhotos } from "@/lib/upload-photos";
import { useAreas } from "@/hooks/use-app-lookups";
import { useCurrentRole } from "@/hooks/use-current-role";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertasPage,
});

function AlertasPage() {
  const qc = useQueryClient();
  const { canResolveNC: podeEditar, canManageNC: podeExcluir } = useCurrentRole();
  const { data: areas = [] } = useAreas();

  const [filtro, setFiltro] = useState("ativos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [areaId, setAreaId] = useState("");
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10));
  const [procedimento, setProcedimento] = useState("");
  const [status, setStatus] = useState("ativo");
  const [fotos, setFotos] = useState<File[]>([]);

  const { data: itens = [] } = useQuery({
    queryKey: ["alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_processo")
        .select("*, areas(nome)")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = itens.filter((a: any) =>
    filtro === "todos" ? true : filtro === "ativos" ? a.status === "ativo" : a.status === "encerrado",
  );

  function reset() {
    setEditing(null);
    setTitulo("");
    setDescricao("");
    setAreaId("");
    setDataEmissao(new Date().toISOString().slice(0, 10));
    setProcedimento("");
    setStatus("ativo");
    setFotos([]);
  }

  function openEdit(a: any) {
    setEditing(a);
    setTitulo(a.titulo ?? "");
    setDescricao(a.descricao ?? "");
    setAreaId(a.area_id ?? "");
    setDataEmissao(a.data_emissao ?? "");
    setProcedimento(a.procedimento ?? "");
    setStatus(a.status ?? "ativo");
    setFotos([]);
    setOpen(true);
  }

  async function save() {
    if (!titulo.trim()) return toast.error("Informe o título do alerta");
    setSaving(true);
    try {
      const novas = await uploadPhotos(fotos, `alertas/${editing?.id ?? "novo"}`);
      const payload: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        area_id: areaId || null,
        data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
        procedimento: procedimento.trim() || null,
        status,
      };
      if (editing) {
        payload.foto_urls = [...(editing.foto_urls ?? []), ...novas];
        const { error } = await supabase.from("alertas_processo").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.foto_urls = novas;
        payload.created_by = u.user?.id ?? null;
        const { error } = await supabase.from("alertas_processo").insert(payload);
        if (error) throw error;
      }
      toast.success("Alerta salvo");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["alertas"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este alerta?")) return;
    const { error } = await supabase.from("alertas_processo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["alertas"] });
  }

  async function toggleStatus(a: any) {
    const novo = a.status === "ativo" ? "encerrado" : "ativo";
    const { error } = await supabase.from("alertas_processo").update({ status: novo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(novo === "ativo" ? "Alerta reaberto" : "Alerta encerrado");
    qc.invalidateQueries({ queryKey: ["alertas"] });
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-accent" />
            Alertas de Processo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {itens.filter((a: any) => a.status === "ativo").length} ativo(s)
          </p>
        </div>
        {podeEditar && (
          <Button
            onClick={() => {
              reset();
              setOpen(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-1" /> Novo alerta
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "ativos", label: "Ativos" },
          { value: "encerrados", label: "Encerrados" },
          { value: "todos", label: "Todos" },
        ].map((f) => (
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
              Nenhum alerta encontrado.
            </CardContent>
          </Card>
        )}
        {lista.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        a.status === "ativo"
                          ? "bg-red-100 text-red-700"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {a.status === "ativo" ? "Ativo" : "Encerrado"}
                    </Badge>
                    {a.areas?.nome && <Badge variant="secondary">{a.areas.nome}</Badge>}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{a.titulo}</p>
                  {a.descricao && <p className="text-sm text-muted-foreground">{a.descricao}</p>}
                  {a.procedimento && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Procedimento: {a.procedimento}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {podeEditar && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(a)}>
                        {a.status === "ativo" ? "Encerrar" : "Reabrir"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {podeExcluir && (
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
              {Array.isArray(a.foto_urls) && a.foto_urls.length > 0 && (
                <EvidenceThumbs paths={a.foto_urls} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar alerta" : "Novo alerta de processo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título do alerta *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Área impactada</Label>
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
                <Label>Data de emissão</Label>
                <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
              </div>
              <div>
                <Label>Procedimento relacionado</Label>
                <Input value={procedimento} onChange={(e) => setProcedimento(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PhotoPicker label="Anexo de foto" files={fotos} onChange={setFotos} />
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
