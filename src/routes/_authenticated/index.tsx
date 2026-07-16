import logoAsset from "@/assets/logo-empresas.png.asset.json";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Plus,
  MapPin,
  Calendar,
} from "lucide-react";
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
} from "recharts";
import { classificaPontuacao } from "@/lib/audit-constants";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const auditoriasQuery = useQuery({
    queryKey: ["auditorias-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*, areas(nome), auditores(nome)")
        .order("data_auditoria", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ncQuery = useQuery({
    queryKey: ["nc-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nao_conformidades").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const auditorias = auditoriasQuery.data ?? [];
  const ncs = ncQuery.data ?? [];

  const total = auditorias.length;
  const mediaPct =
    total > 0
      ? auditorias.reduce((s, a: any) => s + Number(a.percentual || 0), 0) / total
      : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const ncAbertas = ncs.filter(
    (n: any) => n.status === "aberta" || n.status === "em_andamento",
  ).length;
  const ncConcluidas = ncs.filter((n: any) => n.status === "concluida").length;
  const ncVencidas = ncs.filter(
    (n: any) =>
      (n.status === "aberta" || n.status === "em_andamento") &&
      n.prazo &&
      n.prazo < hoje,
  ).length;

  // Últimas 8 auditorias (chart)
  const chartData = [...auditorias]
    .slice(0, 8)
    .reverse()
    .map((a: any) => ({
      name: a.areas?.nome?.slice(0, 10) ?? "—",
      pct: Number(a.percentual),
      data: new Date(a.data_auditoria).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));

  // Média por área
  const porArea = new Map<string, { total: number; count: number }>();
  auditorias.forEach((a: any) => {
    const nome = a.areas?.nome ?? "Sem área";
    const cur = porArea.get(nome) ?? { total: 0, count: 0 };
    cur.total += Number(a.percentual);
    cur.count += 1;
    porArea.set(nome, cur);
  });
  const areaChart = Array.from(porArea.entries())
    .map(([nome, v]) => ({ nome, media: Math.round(v.total / v.count) }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 6);

  // Evolução mensal (últimos 6 meses)
  const porMes = new Map<string, { total: number; count: number }>();
  auditorias.forEach((a: any) => {
    const d = new Date(a.data_auditoria);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = porMes.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(a.percentual);
    cur.count += 1;
    porMes.set(key, cur);
  });
  const mesChart = Array.from(porMes.entries())
    .sort()
    .slice(-6)
    .map(([key, v]) => ({
      mes: key.slice(5) + "/" + key.slice(2, 4),
      media: Math.round(v.total / v.count),
    }));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-center">
        <img
          src={logoAsset.url}
          alt="Grupo JSL"
          className="h-12 md:h-16 w-auto max-w-full object-contain"
        />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">
            Housekeeping · Processos
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das auditorias, indicadores e planos de ação.
          </p>
        </div>
        <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/auditorias/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Auditoria
          </Link>
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KpiCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="Auditorias"
          value={total.toString()}
          hint="Últimas 50"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Score médio"
          value={`${mediaPct.toFixed(0)}%`}
          hint={classificaPontuacao(mediaPct).label}
          accent
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="NCs Abertas"
          value={ncAbertas.toString()}
          hint="Pendentes"
          variant="warning"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="NCs Vencidas"
          value={ncVencidas.toString()}
          hint="Prazo excedido"
          variant="warning"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="NCs Concluídas"
          value={ncConcluidas.toString()}
          hint="Tratadas"
          variant="success"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução das últimas auditorias</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="#1E40AF"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#F59E0B" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Média por área</CardTitle>
          </CardHeader>
          <CardContent>
            {areaChart.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={areaChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip />
                  <Bar dataKey="media" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução mensal + Ranking */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução mensal (média)</CardTitle>
          </CardHeader>
          <CardContent>
            {mesChart.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={mesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="media" stroke="#1E40AF" strokeWidth={2.5} dot={{ r: 4, fill: "#F59E0B" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de áreas</CardTitle>
          </CardHeader>
          <CardContent>
            {areaChart.length === 0 ? (
              <EmptyChart />
            ) : (
              <ol className="space-y-2">
                {areaChart.map((a, i) => (
                  <li key={a.nome} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">{a.nome}</span>
                    <Badge className={`${classificaPontuacao(a.media).color} border-0 font-semibold`}>
                      {a.media}%
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recentes */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Auditorias recentes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auditorias">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {auditorias.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma auditoria registrada ainda.
            </div>
          ) : (
            <ul className="divide-y">
              {auditorias.slice(0, 5).map((a: any) => {
                const cls = classificaPontuacao(Number(a.percentual));
                return (
                  <li key={a.id}>
                    <Link
                      to="/auditorias/$id"
                      params={{ id: a.id }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-muted/50 rounded px-2 -mx-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {a.areas?.nome ?? "Sem área"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(a.data_auditoria).toLocaleDateString("pt-BR")}
                          {" · "}
                          {a.auditores?.nome ?? "—"}
                        </p>
                      </div>
                      <Badge className={`${cls.color} border-0 font-semibold shrink-0`}>
                        {Number(a.percentual).toFixed(0)}%
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  variant,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  variant?: "success" | "warning";
  accent?: boolean;
}) {
  const iconBg =
    variant === "success"
      ? "bg-emerald-100 text-emerald-700"
      : variant === "warning"
        ? "bg-amber-100 text-amber-700"
        : accent
          ? "bg-accent text-accent-foreground"
          : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-lg shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl md:text-2xl font-bold text-primary truncate">{value}</p>
          </div>
        </div>
        {hint && <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
      Sem dados suficientes
    </div>
  );
}
