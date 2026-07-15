import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/areas")({
  component: AreasPage,
});

function AreasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    const { error } = await supabase.from("areas").insert({ nome, setor, descricao });
    if (error) return toast.error(error.message);
    toast.success("Área cadastrada");
    setNome(""); setSetor(""); setDescricao(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["areas"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta área?")) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["areas"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <MapPin className="h-7 w-7 text-accent" />
            Áreas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{data.length} cadastrada(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova área</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Doca 3" />
              </div>
              <div>
                <Label>Setor</Label>
                <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Expedição" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma área cadastrada.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-primary truncate">{a.nome}</p>
                  {a.setor && <p className="text-xs text-muted-foreground">{a.setor}</p>}
                  {a.descricao && <p className="text-sm mt-1">{a.descricao}</p>}
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
