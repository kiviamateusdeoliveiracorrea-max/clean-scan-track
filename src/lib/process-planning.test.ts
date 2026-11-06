// @ts-ignore bun runtime module (testes rodam com bun test)
import { describe, expect, test } from "bun:test";
import {
  startOfWeek,
  startOfMonth,
  weeklyCompletionTrend,
  areaNotaEvolution,
  countInRange,
  completionPct,
} from "./process-planning";

describe("startOfWeek", () => {
  test("segunda-feira é o primeiro dia da semana", () => {
    // 2026-11-06 é uma sexta-feira
    const ws = startOfWeek(new Date(2026, 10, 6, 15, 30));
    expect(ws.getDay()).toBe(1); // segunda
    expect(ws.getDate()).toBe(2); // 02/11/2026
    expect(ws.getHours()).toBe(0);
  });

  test("domingo pertence à semana que começou na segunda anterior", () => {
    // 2026-11-08 é um domingo
    const ws = startOfWeek(new Date(2026, 10, 8));
    expect(ws.getDate()).toBe(2); // segunda 02/11/2026
  });
});

describe("startOfMonth", () => {
  test("retorna o dia 1 do mês", () => {
    const sm = startOfMonth(new Date(2026, 10, 15));
    expect(sm.getDate()).toBe(1);
    expect(sm.getMonth()).toBe(10);
  });
});

describe("weeklyCompletionTrend", () => {
  test("conta concluídas por semana e retorna 8 semanas", () => {
    const today = new Date();
    const y = today.toISOString().slice(0, 10);
    const result = weeklyCompletionTrend([{ data_auditoria: y }, { data_auditoria: y }], 8);
    expect(result.length).toBe(8);
    expect(result[7].concluidas).toBe(2); // semana atual é a última
    expect(result[0].concluidas).toBe(0);
  });
});

describe("areaNotaEvolution", () => {
  test("calcula média arredondada por área e mês", () => {
    const mesAtual = new Date().toISOString().slice(0, 7);
    const { rows, areas } = areaNotaEvolution(
      [
        { data_auditoria: `${mesAtual}-05`, nota_final: 80, areas: { nome: "CTT" } },
        { data_auditoria: `${mesAtual}-12`, nota_final: 100, areas: { nome: "CTT" } },
        { data_auditoria: `${mesAtual}-10`, nota_final: 60, areas: { nome: "PSBU" } },
      ],
      6,
    );
    expect(areas.sort()).toEqual(["CTT", "PSBU"]);
    const atual = rows[rows.length - 1];
    expect(atual["CTT"]).toBe(90);
    expect(atual["PSBU"]).toBe(60);
  });

  test("ignora auditorias sem nota e meses fora da janela", () => {
    const { rows, areas } = areaNotaEvolution(
      [
        { data_auditoria: "2020-01-10", nota_final: 50, areas: { nome: "Antiga" } },
        { data_auditoria: new Date().toISOString().slice(0, 10), nota_final: null, areas: { nome: "CTT" } },
      ],
      6,
    );
    expect(areas).toEqual([]);
    expect(rows.length).toBe(6);
  });
});

describe("countInRange / completionPct", () => {
  test("conta apenas dentro do intervalo", () => {
    const audits = [{ data_auditoria: "2026-11-03" }, { data_auditoria: "2026-10-20" }];
    expect(countInRange(audits, new Date(2026, 10, 2), new Date(2026, 10, 9))).toBe(1);
  });

  test("percentual é 0 quando a meta é 0", () => {
    expect(completionPct(5, 0)).toBe(0);
    expect(completionPct(3, 4)).toBe(75);
  });
});
