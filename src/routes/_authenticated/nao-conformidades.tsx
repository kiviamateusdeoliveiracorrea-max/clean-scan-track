import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Calendar, User, MapPin } from "lucide-react";
import { STATUS_NC, SEVERIDADES } from "@/lib/audit-constants";

export const Route = createFileRoute("/nao-conformidades")({
  component: NCList,
});

function NCList() {
  const [status, setStatus] = useState("todos");
  const [sev, setSev] = useState("todos");

  const { data = [] } = useQuery({
    queryKey: ["ncs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*, areas(nome), auditorias(data_auditoria, auditores(nome))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = data.filter((n: any) => {
    if (status !== "todos" && n.status !== status) return false;
    if (sev !== "todos" && n.severidade !== sev) return false;
    return true;
  });

  const sevColor: Record<string, string> = {
    baixa: "bg-slate-100 text-slate-700",
    media: "bg-blue-100 text-blue-700",
    alta: "bg-amber-100 text-amber-700",
    critica: "bg-red-100 text-red-700",
  };
  const statusColor: Record<string, string> = {
    aberta: "bg-red-100 text-red-700",
    em_andamento: "bg-amber-100 text-amber-700",
    concluida: "bg-emerald-100 text-emerald-700",
    cancelada: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-accent" />
          Não Conformidades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.length} registro(s) no total
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_NC.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as severidades</SelectItem>
            {SEVERIDADES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma não conformidade encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n: any) => (
            <Link
              key={n.id}
              to="/auditorias/$id"
              params={{ id: n.auditoria_id }}
              className="block"
            >
              <Card className="hover:border-accent transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`${statusColor[n.status] ?? ""} border-0`}>
                      {STATUS_NC.find((s) => s.value === n.status)?.label ?? n.status}
                    </Badge>
                    <Badge className={`${sevColor[n.severidade] ?? ""} border-0`}>
                      {SEVERIDADES.find((s) => s.value === n.severidade)?.label ?? n.severidade}
                    </Badge>
                    <Badge variant="outline">{n.criterio}</Badge>
                  </div>
                  <p className="text-sm font-medium">{n.descricao}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {n.areas?.nome && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {n.areas.nome}
                      </span>
                    )}
                    {n.auditorias?.data_auditoria && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(n.auditorias.data_auditoria).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {n.responsavel && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {n.responsavel}
                      </span>
                    )}
                    {n.prazo && (
                      <span>Prazo: {new Date(n.prazo).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
