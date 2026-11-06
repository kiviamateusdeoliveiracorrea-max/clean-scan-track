// Agregações do painel de Planejamento da Auditoria de Processo.
// Funções puras (sem acesso a banco ou navegador) para facilitar testes.

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // semana começa na segunda
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function weeklyCompletionTrend(
  audits: { data_auditoria: string }[],
  weeks = 8,
) {
  const today = new Date();
  const result: { inicio: string; label: string; concluidas: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = startOfWeek(today);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const concluidas = audits.filter((a) => {
      const d = new Date(a.data_auditoria);
      return d >= ws && d < we;
    }).length;
    result.push({
      inicio: ws.toISOString().slice(0, 10),
      label: ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      concluidas,
    });
  }
  return result;
}

export function areaNotaEvolution(
  audits: { data_auditoria: string; nota_final: number | null; areas?: { nome?: string } | null }[],
  months = 6,
) {
  const today = new Date();
  const buckets: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = startOfMonth(today);
    d.setMonth(d.getMonth() - i);
    buckets.push(d.toISOString().slice(0, 7));
  }
  const porAreaMes = new Map<string, Map<string, { soma: number; qtd: number }>>();
  audits.forEach((a) => {
    if (a.nota_final == null) return;
    const nome = a.areas?.nome ?? "Sem área";
    const mes = a.data_auditoria.slice(0, 7);
    if (!buckets.includes(mes)) return;
    if (!porAreaMes.has(nome)) porAreaMes.set(nome, new Map());
    const m = porAreaMes.get(nome)!;
    const cur = m.get(mes) ?? { soma: 0, qtd: 0 };
    cur.soma += Number(a.nota_final);
    cur.qtd += 1;
    m.set(mes, cur);
  });
  const areas = Array.from(porAreaMes.keys());
  const rows = buckets.map((mes) => {
    const row: Record<string, string | number | null> = {
      mes: new Date(mes + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    };
    areas.forEach((area) => {
      const cell = porAreaMes.get(area)?.get(mes);
      row[area] = cell ? Math.round(cell.soma / cell.qtd) : null;
    });
    return row;
  });
  return { rows, areas };
}

/** Conta auditorias concluídas dentro do período [inicio, fim). */
export function countInRange(audits: { data_auditoria: string }[], inicio: Date, fim: Date): number {
  return audits.filter((a) => {
    const d = new Date(a.data_auditoria);
    return d >= inicio && d < fim;
  }).length;
}

/** Percentual de cumprimento: concluídas ÷ meta (0 quando a meta é 0). */
export function completionPct(concluidas: number, meta: number): number {
  return meta > 0 ? Math.round((concluidas / meta) * 100) : 0;
}
