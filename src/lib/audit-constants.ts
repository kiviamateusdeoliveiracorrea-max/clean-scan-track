export const CRITERIOS_5S = [
  {
    key: "seiri",
    nome: "Seiri",
    titulo: "Utilização",
    descricao: "Separar o necessário do desnecessário. Remover itens sem uso da área.",
  },
  {
    key: "seiton",
    nome: "Seiton",
    titulo: "Organização",
    descricao: "Um lugar para cada coisa. Sinalização, endereçamento e demarcação.",
  },
  {
    key: "seiso",
    nome: "Seiso",
    titulo: "Limpeza",
    descricao: "Ambiente limpo, equipamentos e áreas de circulação livres de sujeira.",
  },
  {
    key: "seiketsu",
    nome: "Seiketsu",
    titulo: "Padronização",
    descricao: "Procedimentos padronizados, EPIs e sinalização de segurança em ordem.",
  },
  {
    key: "shitsuke",
    nome: "Shitsuke",
    titulo: "Disciplina",
    descricao: "Manutenção da cultura 5S. Rotina, treinamento e melhoria contínua.",
  },
] as const;

export type Criterio5SKey = (typeof CRITERIOS_5S)[number]["key"];

export const ESCALA_PONTUACAO = [
  {
    faixa: "10",
    min: 10,
    max: 10,
    titulo: "Atendimento total",
    descricao: "Nenhuma não conformidade observada.",
  },
  {
    faixa: "8 – 9",
    min: 8,
    max: 9,
    titulo: "Pequenos desvios",
    descricao: "Sem impacto significativo. Até 1 não conformidade leve identificada.",
  },
  {
    faixa: "6 – 7",
    min: 6,
    max: 7,
    titulo: "Atendimento parcial",
    descricao: "Desvios visíveis que necessitam correção, sem comprometer totalmente o padrão.",
  },
  {
    faixa: "4 – 5",
    min: 4,
    max: 5,
    titulo: "Diversas não conformidades",
    descricao: "O requisito é atendido apenas parcialmente.",
  },
  {
    faixa: "1 – 3",
    min: 1,
    max: 3,
    titulo: "Grave descumprimento",
    descricao: "Grande quantidade de desvios e ausência de padronização.",
  },
  {
    faixa: "0",
    min: 0,
    max: 0,
    titulo: "Requisito não atendido",
    descricao: "Situação crítica ou inexistência do padrão exigido.",
  },
] as const;

export function severidadePorNota(nota: number): "baixa" | "media" | "alta" | "critica" {
  if (nota < 4) return "critica";
  if (nota < 6) return "alta";
  if (nota < 8) return "media";
  return "baixa";
}

export const SEVERIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
] as const;

export const STATUS_NC = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export function classificaPontuacao(percentual: number): {
  label: string;
  color: string;
} {
  if (percentual >= 90) return { label: "Excelente", color: "text-emerald-600 bg-emerald-50" };
  if (percentual >= 75) return { label: "Bom", color: "text-blue-600 bg-blue-50" };
  if (percentual >= 60) return { label: "Regular", color: "text-amber-600 bg-amber-50" };
  return { label: "Crítico", color: "text-red-600 bg-red-50" };
}
