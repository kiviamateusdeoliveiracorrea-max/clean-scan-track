import { useSyncExternalStore } from "react";

const KEY = "active-unit-id";
let current: string | null = null;
const listeners = new Set<() => void>();

function read() {
  if (current === null && typeof window !== "undefined") current = window.localStorage.getItem(KEY);
  return current;
}

/** Unidade ativa selecionada no cabeçalho (null = ainda não definida). */
export function getActiveUnitId(): string | null {
  return read();
}

export function setActiveUnitId(id: string | null) {
  current = id;
  if (typeof window !== "undefined") {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  }
  listeners.forEach((l) => l());
}

export function useActiveUnitId() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => read(),
    () => null,
  );
}

/** Aplica o filtro da unidade ativa numa consulta, quando houver unidade escolhida. */
export function byUnit<T extends { eq: (c: string, v: string) => T }>(q: T, column = "unit_id"): T {
  const id = read();
  return id ? q.eq(column, id) : q;
}
