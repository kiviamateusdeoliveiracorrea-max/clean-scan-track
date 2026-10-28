// @ts-ignore Tests run with Bun.
import { describe, expect, test } from "bun:test";
import { fitPhoto, singleFlight, uploadProgress, validateAnswers } from "./audit-save-flow";

describe("audit save consistency", () => {
  test("photos fit 1600 px without changing proportion", () => {
    expect(fitPhoto(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitPhoto(800, 600)).toEqual({ width: 800, height: 600 });
  });
  for (const count of [0, 1, 10, 20]) {
    test(`${count} photos finish at 100%`, () => {
      expect(uploadProgress(count, count, count * 1000)).toEqual({ completed: count, total: count, percent: 100, secondsRemaining: count ? 0 : null });
    });
  }
  test("slow connection estimate and visible progress", () => {
    expect(uploadProgress(3, 19, 15000)).toEqual({ completed: 3, total: 19, percent: 15, secondsRemaining: 80 });
  });
  test("valid answers pass", () => {
    expect(() => validateAnswers([{ id: "1", pergunta: "Organização" }], { "1": { resposta: "SIM" } })).not.toThrow();
  });
  test("failed answer identifies exact question and prevents completion", () => {
    expect(() => validateAnswers([{ id: "1", pergunta: "Organização" }], { "1": { resposta: "INVALID" } })).toThrow("Organização");
  });
  test("empty checklist cannot be concluded", () => {
    expect(() => validateAnswers([], {})).toThrow();
  });
  for (const clicks of [2, 10]) {
    test(`${clicks} simultaneous clicks create exactly one draft`, async () => {
      const run = singleFlight<string>();
      let created = 0;
      const values = await Promise.all(Array.from({ length: clicks }, () => run(async () => { created++; return "draft"; })));
      expect(created).toBe(1);
      expect(values).toEqual(Array(clicks).fill("draft"));
    });
  }
  test("interruption releases lock for retry", async () => {
    const run = singleFlight<string>();
    await expect(run(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(await run(async () => "retry")).toBe("retry");
  });
});