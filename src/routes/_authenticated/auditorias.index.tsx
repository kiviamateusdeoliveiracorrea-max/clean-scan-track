import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, MapPin, Calendar, User } from "lucide-react";
import { classificaPontuacao } from "@/lib/audit-constants";

export const Route = createFileRoute("/auditorias/")({
  component: AuditoriasList,
});

function AuditoriasList() {
  const [q, setQ] = useState("");
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

  const filtered = data.filter((a: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      a.areas?.nome?.toLowerCase().includes(s) ||
      a.auditores?.nome?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Auditorias 5S</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.length} auditoria(s) registradas
          </p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/auditorias/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Auditoria
          </Link>
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por área ou auditor..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma auditoria encontrada.</p>
            <Button asChild className="mt-4">
              <Link to="/auditorias/nova">Criar primeira auditoria</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: any) => {
            const cls = classificaPontuacao(Number(a.percentual));
            return (
              <Link key={a.id} to="/auditorias/$id" params={{ id: a.id }}>
                <Card className="hover:border-accent transition-colors h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary truncate flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-accent shrink-0" />
                          {a.areas?.nome ?? "Sem área"}
                        </p>
                        {a.areas?.setor && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.areas.setor}
                          </p>
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
                      Pontuação: <span className="font-semibold text-foreground">{a.pontuacao_total}/50</span>
                      {" · "}
                      <span className={cls.color.split(" ")[0]}>{cls.label}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
