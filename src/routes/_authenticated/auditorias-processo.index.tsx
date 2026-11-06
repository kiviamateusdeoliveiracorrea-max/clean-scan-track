import { unitMatch } from "@/lib/active-unit";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, MapPin, Calendar, User, Trash2 } from "lucide-react";
import { classificaPontuacao } from "@/lib/audit-constants";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useProcessAuditManager } from "@/hooks/use-process-audit-permission";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias-processo/")({
  head: () => ({
    meta: [
      { title: "Auditorias de Processo — AuditLog 5S" },
      { name: "description", content: "Listagem das auditorias de processo por área, auditor e colaborador auditado." },
      { property: "og:title", content: "Auditorias de Processo — AuditLog 5S" },
      { property: "og:description", content: "Listagem das auditorias de processo por área, auditor e colaborador auditado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriasProcessoList,
});

type Filtro = "todas" | "rascunho" | "concluida";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  concluida: "Concluída",
};

function AuditoriasProcessoList() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { role } = useCurrentRole();
  const canCreate = role === "administrador" || role === "gestor" || role === "auditor";
  const canDraftDelete = role === "administrador" || role === "gestor";
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["auditorias-processo-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias_processo")
        .select("*, areas(nome, setor), auditores(nome)")
        .match(unitMatch())
        .order("data_auditoria", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const canManage = useProcessAuditManager(data.map((a: any) => a.auditor_id));
  const canDelete = (a: any) => (a.status === "concluida" ? canManage(a.auditor_id) : canDraftDelete);

  const filtered = useMemo(() => {
    return data.filter((a: any) => {
      if (filtro !== "todas" && a.status !== filtro) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        a.areas?.nome?.toLowerCase().includes(s) ||
        a.auditores?.nome?.toLowerCase().includes(s) ||
        a.colaborador_auditado?.toLowerCase().includes(s)
      );
    });
  }, [data, q, filtro]);

  const handleDelete = async (a: any) => {
    const concluida = a.status === "concluida";
    const msg = concluida
      ? "Excluir esta auditoria de processo JÁ CONCLUÍDA? Essa ação não pode ser desfeita e remove respostas, ações e os dados dos indicadores do dashboard."
      : "Excluir este rascunho de auditoria de processo?";
    if (!confirm(msg)) return;
    // Respostas e ações são removidas em cascata pelo banco.
    const { data: removed, error } = await supabase.from("auditorias_processo").delete().eq("id", a.id).select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!removed?.length) {
      toast.error("Sem permissão para excluir esta auditoria.");
      return;
    }
    toast.success(concluida ? "Auditoria excluída" : "Rascunho excluído");
    qc.invalidateQueries({ queryKey: ["auditorias-processo-list"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Auditorias de Processo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.filter((a: any) => a.status === "concluida").length} concluída(s) ·{" "}
            {data.filter((a: any) => a.status === "rascunho").length} rascunho(s)
          </p>
        </div>
        {canCreate && (
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/auditorias-processo/nova">
              <Plus className="h-4 w-4 mr-2" />
              Nova auditoria de processo
            </Link>
          </Button>
        )}
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="rascunho">Rascunho</TabsTrigger>
            <TabsTrigger value="concluida">Concluída</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por área, auditor ou colaborador..."
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
            <p className="text-sm text-muted-foreground">Nenhuma auditoria de processo encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: any) => {
            const concluida = a.status === "concluida";
            const cls = concluida && a.nota_final != null ? classificaPontuacao(Number(a.nota_final)) : null;
            return (
              <Card key={a.id} className="h-full hover:border-accent transition-colors">
                <CardContent className="p-4 space-y-3">
                  <Link to="/auditorias-processo/$id" params={{ id: a.id }} className="block space-y-3">
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
                      {cls ? (
                        <Badge className={`${cls.color} border-0 font-bold shrink-0`}>
                          {Number(a.nota_final).toFixed(0)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      )}
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
                    <div className="pt-2 border-t text-[11px] text-muted-foreground space-y-0.5">
                      {a.colaborador_auditado && (
                        <p>
                          Colaborador:{" "}
                          <span className="font-semibold text-foreground">{a.colaborador_auditado}</span>
                        </p>
                      )}
                      <p>
                        Status:{" "}
                        <span className="font-semibold text-foreground">
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                        {cls && (
                          <>
                            {" · "}
                            <span className={cls.color.split(" ")[0]}>{cls.label}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </Link>
                  {canDelete(a) && (
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(a);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
