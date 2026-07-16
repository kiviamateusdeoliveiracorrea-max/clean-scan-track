import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserCog, Plus, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auditores")({
  component: AuditoresPage,
});

function AuditoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [matricula, setMatricula] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["auditores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    const { error } = await supabase.from("auditores").insert({ nome, email, matricula });
    if (error) return toast.error(error.message);
    toast.success("Auditor cadastrado");
    setNome(""); setEmail(""); setMatricula(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["auditores"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este auditor?")) return;
    const { error } = await supabase.from("auditores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["auditores"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <UserCog className="h-7 w-7 text-accent" />
            Auditores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{data.length} cadastrado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo auditor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum auditor cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-primary truncate">{a.nome}</p>
                  {a.matricula && <p className="text-xs text-muted-foreground">Mat.: {a.matricula}</p>}
                  {a.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" /> {a.email}
                    </p>
                  )}
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
