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
