import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, MapPin, Calendar, User } from "lucide-react";
import { classificaPontuacao } from "@/lib/audit-constants";

export const Route = createFileRoute("/_authenticated/historico")({
  component: Historico,
});

function Historico() {
  const { data = [] } = useQuery({
    queryKey: ["historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*, areas(nome), auditores(nome)")
        .order("data_auditoria", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // agrupar por mês
  const grouped = new Map<string, any[]>();
  data.forEach((a: any) => {
    const d = new Date(a.data_auditoria);
    const key = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const arr = grouped.get(key) ?? [];
    arr.push(a);
    grouped.set(key, arr);
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
          <History className="h-7 w-7 text-accent" />
          Histórico de Auditorias
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.length} auditoria(s) no total
        </p>
      </header>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma auditoria registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([mes, items]) => (
            <div key={mes}>
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-2 capitalize">
                {mes}
              </h2>
              <div className="border-l-2 border-accent/40 pl-4 space-y-3">
                {items.map((a: any) => {
                  const cls = classificaPontuacao(Number(a.percentual));
                  return (
                    <Link
                      key={a.id}
                      to="/auditorias/$id"
                      params={{ id: a.id }}
                      className="block relative"
                    >
                      <div className="absolute -left-[21px] top-4 h-3 w-3 rounded-full bg-accent" />
                      <Card className="hover:border-accent transition-colors">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                            <div className="min-w-0">
                              <p className="font-semibold text-primary truncate flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-accent shrink-0" />
                                {a.areas?.nome ?? "Sem área"}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(a.data_auditoria).toLocaleDateString("pt-BR")}
                                </span>
                                <span className="flex items-center gap-1 truncate">
                                  <User className="h-3 w-3 shrink-0" />
                                  {a.auditores?.nome ?? "—"}
                                </span>
                              </div>
                            </div>
                            <Badge className={`${cls.color} border-0 font-bold shrink-0`}>
                              {Number(a.percentual).toFixed(0)}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
