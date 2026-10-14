export type RespostaScore = "SIM" | "NÃO" | "NA";

export interface ItemScore {
  resposta: RespostaScore;
  peso?: number | null;
}

export interface ResultadoScore {
  pontosObtidos: number;
  pontosPossiveis: number;
  percentual: number | null;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
}

function pesoValido(peso: number | null | undefined): number {
  if (peso === null || peso === undefined) return 1;
  const n = Number(peso);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Peso inválido: ${peso}. O peso deve ser um número maior ou igual a zero.`);
  }
  return n;
}

/**
 * Percentual = soma dos pontos obtidos / soma dos pontos possíveis × 100.
 * - "SIM" (Conforme): soma o peso em obtidos e possíveis.
 * - "NÃO" (Não Conforme): soma o peso apenas em possíveis (reduz a nota).
 * - "NA" (Não Aplicável): excluída do cálculo.
 * Retorna percentual null quando não há pontos possíveis.
 */
export function calcularScore(itens: ItemScore[]): ResultadoScore {
  let obtidos = 0;
  let possiveis = 0;
  let conformes = 0;
  let naoConformes = 0;
  let naoAplicaveis = 0;
  let ncComPeso = false;

  for (const item of itens) {
    if (item.resposta === "NA") {
      naoAplicaveis++;
      continue;
    }
    const peso = pesoValido(item.peso);
    if (item.resposta === "SIM") {
      conformes++;
      obtidos += peso;
      possiveis += peso;
    } else if (item.resposta === "NÃO") {
      naoConformes++;
      possiveis += peso;
      if (peso > 0) ncComPeso = true;
    } else {
      throw new Error(`Resposta inválida: ${String((item as ItemScore).resposta)}`);
    }
  }

  let percentual: number | null = possiveis > 0 ? (obtidos / possiveis) * 100 : null;
  if (percentual !== null) {
    percentual = Math.min(100, Math.max(0, percentual));
    // Garantia: nunca 100% com Não Conforme de peso > 0 (inclusive por arredondamento).
    if (ncComPeso && percentual >= 100) percentual = 99.99;
  }

  return {
    pontosObtidos: obtidos,
    pontosPossiveis: possiveis,
    percentual,
    conformes,
    naoConformes,
    naoAplicaveis,
  };
}
