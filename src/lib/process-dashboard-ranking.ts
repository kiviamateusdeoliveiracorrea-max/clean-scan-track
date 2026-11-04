type ProcessAudit = {
  status: string;
  nota_final: number | string | null;
  areas: { nome: string } | null;
};

export function rankProcessAreas(audits: readonly ProcessAudit[]) {
  const porAreaProcesso = new Map<string, { total: number; count: number }>();
  audits.forEach((a) => {
    if (a.status !== "concluida") return;
    const nome = a.areas?.nome ?? "Sem área";
    const cur = porAreaProcesso.get(nome) ?? { total: 0, count: 0 };
    cur.total += Number(a.nota_final || 0);
    cur.count += 1;
    porAreaProcesso.set(nome, cur);
  });
  return Array.from(porAreaProcesso.entries())
    .map(([nome, v]) => ({ nome, media: Math.round(v.total / v.count), auditorias: v.count }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 3);
}