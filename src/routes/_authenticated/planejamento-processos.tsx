import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Target, CalendarRange, CalendarDays, Save } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { byUnit, unitMatch, useActiveUnitId } from "@/lib/active-unit";
import { useCurrentRole } from "@/hooks/use-current-role";
import {
  startOfWeek,
  startOfMonth,
  weeklyCompletionTrend,
  areaNotaEvolution,
  countInRange,
  completionPct,
} from "@/lib/process-planning";

export const Route = createFileRoute("/_authenticated/planejamento-processos")({
  head: () => ({
    meta: [
      { title: "Planejamento — Auditoria de Processos" },
      { name: "description", content: "Metas semanais e mensais de auditorias de processo, percentual de cumprimento e evolução da nota média por área." },
      { property: "og:title", content: "Planejamento — Auditoria de Processos" },
      { property: "og:description", content: "Metas semanais e mensais de auditorias de processo, percentual de cumprimento e evolução da nota média por área." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoProcessos,
});

const AREA_COLORS = ["#1E40AF", "#F59E0B", "#059669", "#DC2626", "#7C3AED", "#0891B2"];

function PlanejamentoProcessos() {
  const unitId = useActiveUnitId();
  const { canManageUsers } = useCurrentRole();
  const queryClient = useQueryClient();

  const metasQuery = useQuery({
    queryKey: ["metas-processo", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await byUnit(
        supabase.from("metas_processo").select("*"),
      ).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const auditoriasQuery = useQuery({
    queryKey: ["auditorias-processo-planejamento", unitId],
    queryFn: async () => {
      const inicio = startOfMonth(new Date());
      inicio.setMonth(inicio.getMonth() - 5);
      const { data, error } = await supabase
        .from("auditorias_processo")
        .select("id, data_auditoria, nota_final, areas(nome)")
        .match(unitMatch())
        .eq("status", "concluida")
        .gte("data_auditoria", inicio.toISOString().slice(0, 10))
        .order("data_auditoria", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const metaSemanal = metasQuery.data?.meta_semanal ?? 0;
  const metaMensal = metasQuery.data?.meta_mensal ?? 0;

  const [metaSemInput, setMetaSemInput] = useState("0");
  const [metaMenInput, setMetaMenInput] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMetaSemInput(String(metaSemanal));
    setMetaMenInput(String(metaMensal));
  }, [metaSemanal, metaMensal]);

  const salvarMetas = async () => {
    if (!unitId) return;
    const sem = Math.max(0, Math.floor(Number(metaSemInput) || 0));
    const men = Math.max(0, Math.floor(Number(metaMenInput) || 0));
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("metas_processo").upsert({
      unit_id: unitId,
      meta_semanal: sem,
      meta_mensal: men,
      updated_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as metas: " + error.message);
      return;
    }
    toast.success("Metas salvas.");
    queryClient.invalidateQueries({ queryKey: ["metas-processo", unitId] });
  };

  const auditorias = auditoriasQuery.data ?? [];
  const hoje = new Date();
  const fimSemana = new Date(startOfWeek(hoje));
  fimSemana.setDate(fimSemana.getDate() + 7);
  const fimMes = new Date(startOfMonth(hoje));
  fimMes.setMonth(fimMes.getMonth() + 1);

  const concluidasSemana = countInRange(auditorias, startOfWeek(hoje), fimSemana);
  const concluidasMes = countInRange(auditorias, startOfMonth(hoje), fimMes);
  const pctSemana = completionPct(concluidasSemana, metaSemanal);
  const pctMes = completionPct(concluidasMes, metaMensal);

  const trend = weeklyCompletionTrend(auditorias, 8);
  const evolucao = areaNotaEvolution(auditorias, 6);

  if (!unitId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Selecione uma unidade no cabeçalho para ver o planejamento.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Planejamento — Auditoria de Processos
        </h1>
        <p className="text-sm text-muted-foreground">
          Metas de auditorias programadas e evolução das áreas na unidade selecionada.
        </p>
      </div>

      {/* Metas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metas de auditorias programadas</CardTitle>
        </CardHeader>
        <CardContent>
          {canManageUsers ? (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="meta-semanal">Meta semanal</Label>
                <Input
                  id="meta-semanal"
                  type="number"
                  min={0}
                  className="w-32"
                  value={metaSemInput}
                  onChange={(e) => setMetaSemInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="meta-mensal">Meta mensal</Label>
                <Input
                  id="meta-mensal"
                  type="number"
                  min={0}
                  className="w-32"
                  value={metaMenInput}
                  onChange={(e) => setMetaMenInput(e.target.value)}
                />
              </div>
              <Button onClick={salvarMetas} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-8 text-sm">
              <p>
                <span className="text-muted-foreground">Meta semanal: </span>
                <span className="font-semibold">{metaSemanal}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Meta mensal: </span>
                <span className="font-semibold">{metaMensal}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo semana/mês */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Esta semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-2xl font-bold text-foreground">{concluidasSemana}</span>
              {" de "}
              <span className="font-semibold text-foreground">{metaSemanal}</span>
              {" programadas"}
            </p>
            <Progress value={Math.min(pctSemana, 100)} />
            <p className="text-sm font-semibold text-primary">{pctSemana}% da meta semanal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Este mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-2xl font-bold text-foreground">{concluidasMes}</span>
              {" de "}
              <span className="font-semibold text-foreground">{metaMensal}</span>
              {" programadas"}
            </p>
            <Progress value={Math.min(pctMes, 100)} />
            <p className="text-sm font-semibold text-primary">{pctMes}% da meta mensal</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução do cumprimento semanal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução do cumprimento da meta semanal</CardTitle>
        </CardHeader>
        <CardContent>
          {auditorias.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="concluidas" name="Concluídas" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                {metaSemanal > 0 && (
                  <ReferenceLine
                    y={metaSemanal}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                    label={{ value: "Meta", position: "right", fontSize: 11, fill: "#DC2626" }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Evolução da nota por área */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução da nota média por área</CardTitle>
        </CardHeader>
        <CardContent>
          {evolucao.areas.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucao.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {evolucao.areas.map((area, i) => (
                  <Line
                    key={area}
                    type="monotone"
                    dataKey={area}
                    stroke={AREA_COLORS[i % AREA_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
      Sem dados suficientes
    </div>
  );
}
