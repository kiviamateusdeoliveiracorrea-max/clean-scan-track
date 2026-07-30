import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { ListChecks, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentRole } from "@/hooks/use-current-role";

const CATEGORIAS = ["Pessoas", "Ambiente", "Processo"] as const;

export const Route = createFileRoute("/_authenticated/perguntas")({
  head: () => ({
    meta: [
      { title: "Cadastro de Perguntas | Auditoria Intralog" },
      {
        name: "description",
        content:
          "Cadastre, edite e filtre as perguntas de auditoria por área e categoria.",
      },
      { property: "og:title", content: "Cadastro de Perguntas | Auditoria Intralog" },
      {
        property: "og:description",
        content: "Gerencie o banco de perguntas das auditorias por área e categoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerguntasPage,
});

type Pergunta = {
  id: string;
  area_nome: string;
  categoria: string;
  pergunta: string;
  peso: number;
  ativo: boolean;
};

const emptyForm = {
  id: "",
  area_nome: "",
  categoria: "Pessoas",
  pergunta: "",
  peso: "1",
  ativo: true,
};

function PerguntasPage() {
  const qc = useQueryClient();
  const { role } = useCurrentRole();
  const canEdit = role === "administrador" || role === "gestor" || role === "auditor";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const { data = [] } = useQuery({
    queryKey: ["perguntas_auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perguntas_auditoria")
        .select("*")
        .order("area_nome")
        .order("categoria")
        .order("pergunta");
      if (error) throw error;
      return (data ?? []) as Pergunta[];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    areas.forEach((a: any) => a?.nome && set.add(a.nome));
    data.forEach((p) => p.area_nome && set.add(p.area_nome));
    return Array.from(set).sort();
  }, [areas, data]);

  const filtered = useMemo(
    () =>
      data.filter(
        (p) =>
          (filtroArea === "todas" || p.area_nome === filtroArea) &&
          (filtroCategoria === "todas" || p.categoria === filtroCategoria),
      ),
    [data, filtroArea, filtroCategoria],
  );

  const openNew = () => {
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (p: Pergunta) => {
    setForm({
      id: p.id,
      area_nome: p.area_nome,
      categoria: p.categoria,
      pergunta: p.pergunta,
      peso: String(p.peso),
      ativo: p.ativo,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.area_nome.trim()) return toast.error("Informe a área");
    if (!form.pergunta.trim()) return toast.error("Informe a pergunta");
    const peso = Number(form.peso);
    if (!Number.isFinite(peso) || peso <= 0) return toast.error("Peso deve ser maior que zero");

    const payload = {
      area_nome: form.area_nome.trim(),
      categoria: form.categoria,
      pergunta: form.pergunta.trim(),
      peso,
      ativo: form.ativo,
    };

    const { error } = form.id
      ? await supabase.from("perguntas_auditoria").update(payload).eq("id", form.id)
      : await supabase.from("perguntas_auditoria").insert(payload);

    if (error) return toast.error(error.message);
    toast.success(form.id ? "Pergunta atualizada" : "Pergunta cadastrada");
    setOpen(false);
    setForm({ ...emptyForm });
    qc.invalidateQueries({ queryKey: ["perguntas_auditoria"] });
  };

  const remove = async (p: Pergunta) => {
    if (!confirm("Excluir esta pergunta?")) return;
    const { error } = await supabase.from("perguntas_auditoria").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pergunta excluída");
    qc.invalidateQueries({ queryKey: ["perguntas_auditoria"] });
  };

  const toggleAtivo = async (p: Pergunta) => {
    const { error } = await supabase
      .from("perguntas_auditoria")
      .update({ ativo: !p.ativo })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["perguntas_auditoria"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <ListChecks className="h-7 w-7 text-accent" />
            Cadastro de Perguntas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} pergunta(s) exibida(s) de {data.length}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-1" /> Nova pergunta
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Filtrar por área</Label>
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {areaOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filtrar por categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma pergunta encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.area_nome}</Badge>
                    <Badge variant="outline">{p.categoria}</Badge>
                    <Badge variant="outline">Peso {p.peso}</Badge>
                    <Badge className={p.ativo ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{p.pergunta}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleAtivo(p)}
                      className="text-xs text-muted-foreground hover:text-primary px-2 py-1"
                    >
                      {p.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-primary p-1">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(p)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Área *</Label>
              <Input
                value={form.area_nome}
                list="areas-list"
                onChange={(e) => setForm({ ...form, area_nome: e.target.value })}
                placeholder="Ex: CTT"
              />
              <datalist id="areas-list">
                {areaOptions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pergunta *</Label>
              <Textarea
                value={form.pergunta}
                onChange={(e) => setForm({ ...form, pergunta: e.target.value })}
                rows={3}
                placeholder="Ex: O colaborador é treinado?"
              />
            </div>
            <div>
              <Label>Peso *</Label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={form.peso}
                onChange={(e) => setForm({ ...form, peso: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="ativo-switch">Ativo</Label>
              <Switch
                id="ativo-switch"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
