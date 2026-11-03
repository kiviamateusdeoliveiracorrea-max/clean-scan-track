import { unitMatch, pickUnitQuestions, useActiveUnitId } from "@/lib/active-unit";
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
import { ClipboardList, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentRole } from "@/hooks/use-current-role";

const CATEGORIAS = ["Pessoas", "Ambiente", "Processo"] as const;

export const Route = createFileRoute("/_authenticated/perguntas-processo")({
  head: () => ({
    meta: [
      { title: "Cadastro de Perguntas — Auditoria de Processos" },
      {
        name: "description",
        content:
          "Cadastre, edite e filtre as perguntas de auditoria por área e categoria.",
      },
      { property: "og:title", content: "Cadastro de Perguntas — Auditoria de Processos" },
      {
        property: "og:description",
        content: "Gerencie o banco de perguntas das auditorias por área e categoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerguntasProcessoPage,
});

type Pergunta = {
  id: string;
  area_nome: string;
  categoria: string;
  pergunta: string;
  peso: number;
  ativo: boolean;
  ordem: number;
};

const emptyForm = {
  id: "",
  area_nome: "",
  categoria: "Pessoas",
  pergunta: "",
  peso: "1",
  ordem: "0",
  ativo: true,
};

function PerguntasProcessoPage() {
  const qc = useQueryClient();
  const unitId = useActiveUnitId();
  const [saving, setSaving] = useState(false);
  const { role } = useCurrentRole();
  const canEdit = role === "administrador" || role === "gestor" || role === "auditor";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const { data = [] } = useQuery({
    queryKey: ["perguntas_processo", unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perguntas_processo")
        .select("*")
        .order("area_nome")
        .order("categoria")
        .order("ordem")
        .order("pergunta");
      if (error) throw error;
      const rows = data ?? [];
      return [...new Set(rows.map((p) => p.area_nome))].flatMap((area) =>
        pickUnitQuestions(rows.filter((p) => p.area_nome === area)),
      ) as Pergunta[];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas", unitId],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, nome").match(unitMatch()).order("nome");
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
      ordem: String(p.ordem),
      ativo: p.ativo,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!canEdit || saving) return;
    if (!form.area_nome.trim()) return toast.error("Informe a área");
    if (!form.pergunta.trim()) return toast.error("Informe a pergunta");
    const peso = Number(form.peso);
    if (!Number.isFinite(peso) || peso <= 0) return toast.error("Peso deve ser maior que zero");

    const ordem = Number(form.ordem);
    if (!form.ordem.trim() || !Number.isInteger(ordem) || ordem < -2147483648 || ordem > 2147483647) return toast.error("Ordem deve ser um número inteiro");

    const payload = {
      area_nome: form.area_nome.trim(),
      categoria: form.categoria,
      pergunta: form.pergunta.trim(),
      peso,
      ordem,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      const { data: saved, error } = form.id
        ? await supabase.from("perguntas_processo").update(payload).eq("id", form.id).select("id")
        : await supabase.from("perguntas_processo").insert(payload).select("id");
      if (error) throw error;
      if (!saved?.length) throw new Error("Sem permissão para salvar esta pergunta.");
      await qc.invalidateQueries({ queryKey: ["perguntas_processo"] });
      toast.success(form.id ? "Pergunta atualizada" : "Pergunta cadastrada");
      setOpen(false);
      setForm({ ...emptyForm });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a pergunta.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Pergunta) => {
    if (!canEdit) return;
    if (!confirm("Excluir esta pergunta?")) return;
    const { data: deleted, error } = await supabase.from("perguntas_processo").delete().eq("id", p.id).select("id");
    if (error) return toast.error(error.message);
    if (!deleted?.length) return toast.error("Sem permissão para excluir esta pergunta.");
    toast.success("Pergunta excluída");
    qc.invalidateQueries({ queryKey: ["perguntas_processo"] });
  };

  const toggleAtivo = async (p: Pergunta) => {
    if (!canEdit) return;
    const { data: updated, error } = await supabase
      .from("perguntas_processo")
      .update({ ativo: !p.ativo })
      .eq("id", p.id).select("id");
    if (error) return toast.error(error.message);
    if (!updated?.length) return toast.error("Sem permissão para alterar esta pergunta.");
    qc.invalidateQueries({ queryKey: ["perguntas_processo"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-start gap-2">
            <ClipboardList className="h-7 w-7 text-accent shrink-0" />
            Cadastro de Perguntas — Auditoria de Processos
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
              <CardContent className="p-4 flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.area_nome}</Badge>
                    <Badge variant="outline">{p.categoria}</Badge>
                    <Badge variant="outline">Peso {p.peso}</Badge>
                    <Badge variant="outline">Ordem {p.ordem}</Badge>
                    <Badge className={p.ativo ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground break-words">{p.pergunta}</p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleAtivo(p)}>
                      {p.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar pergunta" title="Editar pergunta" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir pergunta" title="Excluir pergunta" onClick={() => remove(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              <Label htmlFor="process-area">Área *</Label>
              <Input
                value={form.area_nome}
                id="process-area"
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
              <Label htmlFor="process-question">Pergunta *</Label>
              <Textarea
                id="process-question"
                value={form.pergunta}
                onChange={(e) => setForm({ ...form, pergunta: e.target.value })}
                rows={3}
                placeholder="Ex: O colaborador é treinado?"
              />
            </div>
            <div>
              <Label htmlFor="process-weight">Peso *</Label>
              <Input
                type="number"
                id="process-weight"
                min="0.1"
                step="0.1"
                value={form.peso}
                onChange={(e) => setForm({ ...form, peso: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="process-order">Ordem</Label>
              <Input id="process-order" type="number" step="1" value={form.ordem}
                onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
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
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
