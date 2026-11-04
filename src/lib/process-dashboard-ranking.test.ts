// @ts-ignore bun runtime module (testes rodam com bun test)
import { expect, test } from "bun:test";
import { rankProcessAreas } from "./process-dashboard-ranking";

const audit = (nome: string, nota_final: number, status = "concluida") => ({
  areas: { nome }, nota_final, status,
});

test("ranking inclui somente áreas com auditorias de processo concluídas", () => {
  expect(rankProcessAreas([audit("CTT", 80), audit("Qualidade", 100, "rascunho")]))
    .toEqual([{ nome: "CTT", media: 80, auditorias: 1 }]);
});

test("ranking usa a média arredondada das notas finais de cada área", () => {
  expect(rankProcessAreas([audit("CTT", 80), audit("CTT", 91)]))
    .toEqual([{ nome: "CTT", media: 86, auditorias: 2 }]);
});

test("ranking ordena da maior média para a menor e limita a três posições", () => {
  expect(rankProcessAreas([
    audit("A", 60), audit("B", 90), audit("C", 70), audit("D", 100),
  ])).toEqual([
    { nome: "D", media: 100, auditorias: 1 },
    { nome: "B", media: 90, auditorias: 1 },
    { nome: "C", media: 70, auditorias: 1 },
  ]);
});

test("ranking vazio sem auditorias concluídas", () => {
  expect(rankProcessAreas([])).toEqual([]);
  expect(rankProcessAreas([audit("CTT", 100, "rascunho")])).toEqual([]);
});