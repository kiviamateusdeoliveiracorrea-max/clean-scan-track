/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { calcularScore, type ItemScore } from "./audit-score";

const itens = (sim: number, nao: number, na: number): ItemScore[] => [
  ...Array.from({ length: sim }, () => ({ resposta: "SIM" as const, peso: 1 })),
  ...Array.from({ length: nao }, () => ({ resposta: "NÃO" as const, peso: 1 })),
  ...Array.from({ length: na }, () => ({ resposta: "NA" as const, peso: 1 })),
];

describe("calcularScore", () => {
  test("Cenário 1: 5 conformes → 100%", () => {
    expect(calcularScore(itens(5, 0, 0)).percentual).toBe(100);
  });
  test("Cenário 2: 4 conformes + 1 não conforme → 80%", () => {
    expect(calcularScore(itens(4, 1, 0)).percentual).toBe(80);
  });
  test("Cenário 3: 4 conformes + 1 não aplicável → 100%", () => {
    expect(calcularScore(itens(4, 0, 1)).percentual).toBe(100);
  });
  test("Cenário 4: 4 conformes + 1 não conforme + 1 não aplicável → 80%", () => {
    expect(calcularScore(itens(4, 1, 1)).percentual).toBe(80);
  });
  test("Nunca 100% com Não Conforme de peso > 0", () => {
    const r = calcularScore([
      ...Array.from({ length: 100000 }, () => ({ resposta: "SIM" as const, peso: 10 })),
      { resposta: "NÃO", peso: 0.0001 },
    ]);
    expect(r.percentual!).toBeLessThan(100);
  });
  test("Usa pesos: obtidos / possíveis", () => {
    const r = calcularScore([
      { resposta: "SIM", peso: 3 },
      { resposta: "NÃO", peso: 1 },
    ]);
    expect(r.percentual).toBe(75);
  });
  test("Peso negativo é rejeitado", () => {
    expect(() => calcularScore([{ resposta: "SIM", peso: -1 }])).toThrow();
  });
  test("Somente não aplicáveis → sem percentual", () => {
    expect(calcularScore(itens(0, 0, 3)).percentual).toBeNull();
  });
});
