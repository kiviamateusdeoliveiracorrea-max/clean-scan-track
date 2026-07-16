import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Search, MapPin, Calendar, User, Trash2, RotateCcw } from "lucide-react";
import { classificaPontuacao } from "@/lib/audit-constants";
import { useCurrentRole } from "@/hooks/use-current-role";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias/")({
  component: AuditoriasList,
});

type Filtro = "ativas" | "canceladas" | "todas";

function AuditoriasList() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativas");
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const { role, isAdmin, canManageUsers } = useCurrentRole();
  const canDelete = isAdmin || role === "gestor";
  const canRestore = isAdmin;
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["auditorias-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*, areas(nome, setor), auditores(nome)")
        .order("data_auditoria", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ audit, motivo }: { audit: any; motivo: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let nome: string | null = null;
      if (uid) {
        const { data: p } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", uid)
          .maybeSingle();
        nome = p?.nome ?? null;
      }
      const { error } = await supabase
        .from("auditorias")
        .update({
          status: "cancelada",
          cancelada_em: new Date().toISOString(),
          cancelada_por: uid ?? null,
          justificativa_cancelamento: motivo,
        } as any)
        .eq("id", audit.id);
      if (error) throw error;
      await supabase.from("auditorias_log" as any).insert({
        auditoria_id: audit.id,
        area_id: audit.area_id,
        area_nome: audit.areas?.nome ?? null,
        data_auditoria: audit.data_auditoria,
        acao: "exclusao",
        justificativa: motivo,
        executado_por: uid ?? null,
        executado_por_nome: nome,
      });
    },
    onSuccess: () => {
      toast.success("Auditoria excluída");
      setToDelete(null);
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["auditorias-list"] });
      qc.invalidateQueries({ queryKey: ["auditorias-dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (audit: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let nome: string | null = null;
      if (uid) {
        const { data: p } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", uid)
          .maybeSingle();
        nome = p?.nome ?? null;
      }
      const { error } = await supabase
        .from("auditorias")
        .update({
          status: "concluida",
          cancelada_em: null,
          cancelada_por: null,
          justificativa_cancelamento: null,
        } as any)
        .eq("id", audit.id);
      if (error) throw error;
      await supabase.from("auditorias_log" as any).insert({
        auditoria_id: audit.id,
        area_id: audit.area_id,
        area_nome: audit.areas?.nome ?? null,
        data_auditoria: audit.data_auditoria,
        acao: "restauracao",
        executado_por: uid ?? null,
        executado_por_nome: nome,
      });
    },
    onSuccess: () => {
      toast.success("Auditoria restaurada");
      qc.invalidateQueries({ queryKey: ["auditorias-list"] });
      qc.invalidateQueries({ queryKey: ["auditorias-dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao restaurar"),
  });

  const filtered = useMemo(() => {
    return data.filter((a: any) => {
      if (filtro === "ativas" && a.status === "cancelada") return false;
      if (filtro === "canceladas" && a.status !== "cancelada") return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        a.areas?.nome?.toLowerCase().includes(s) ||
        a.auditores?.nome?.toLowerCase().includes(s)
      );
    });
  }, [data, q, filtro]);

  const confirmDelete = () => {
    if (!toDelete) return;
    if (justificativa.trim().length < 5) {
      toast.error("Informe uma justificativa (mín. 5 caracteres)");
      return;
    }
    cancelMutation.mutate({ audit: toDelete, motivo: justificativa.trim() });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Auditorias 5S</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.filter((a: any) => a.status !== "cancelada").length} ativa(s) ·{" "}
            {data.filter((a: any) => a.status === "cancelada").length} cancelada(s)
          </p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/auditorias/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Auditoria
          </Link>
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <TabsList>
            <TabsTrigger value="ativas">Ativas</TabsTrigger>
            <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por área ou auditor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma auditoria encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: any) => {
            const cls = classificaPontuacao(Number(a.percentual));
            const isCancelled = a.status === "cancelada";
            return (
              <Card
                key={a.id}
                className={`h-full ${isCancelled ? "opacity-70 border-destructive/40" : "hover:border-accent"} transition-colors`}
              >
                <CardContent className="p-4 space-y-3">
                  <Link
                    to="/auditorias/$id"
                    params={{ id: a.id }}
                    className="block space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary truncate flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-accent shrink-0" />
                          {a.areas?.nome ?? "Sem área"}
                        </p>
                        {a.areas?.setor && (
                          <p className="text-xs text-muted-foreground mt-0.5">{a.areas.setor}</p>
                        )}
                      </div>
                      <Badge className={`${cls.color} border-0 font-bold shrink-0`}>
                        {Number(a.percentual).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(a.data_auditoria).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <User className="h-3 w-3 shrink-0" />
                        {a.auditores?.nome ?? "—"}
                      </span>
                    </div>
                    <div className="pt-2 border-t text-[11px] text-muted-foreground">
                      Pontuação:{" "}
                      <span className="font-semibold text-foreground">
                        {a.pontuacao_total}/50
                      </span>
                      {" · "}
                      <span className={cls.color.split(" ")[0]}>{cls.label}</span>
                    </div>
                  </Link>
                  {isCancelled && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 text-xs">
                      <p className="font-semibold text-destructive">Cancelada</p>
                      {a.justificativa_cancelamento && (
                        <p className="text-muted-foreground mt-0.5">
                          {a.justificativa_cancelamento}
                        </p>
                      )}
                    </div>
                  )}
                  {(canDelete || canRestore) && (
                    <div className="flex justify-end gap-2 pt-1">
                      {!isCancelled && canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            setToDelete(a);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                        </Button>
                      )}
                      {isCancelled && canRestore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            restoreMutation.mutate(a);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) {
            setToDelete(null);
            setJustificativa("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir auditoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta auditoria? Esta ação removerá os
              registros e poderá impactar indicadores e históricos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Justificativa *</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              placeholder="Motivo da exclusão"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Silence unused warning */}
      <span className="hidden">{canManageUsers ? "" : ""}</span>
    </div>
  );
}
