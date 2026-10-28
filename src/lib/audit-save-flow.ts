export const PHOTO_MAX_WIDTH = 1600;
export const PHOTO_TARGET_MB = 0.48;

export function fitPhoto(width: number, height: number) {
  const scale = Math.min(1, PHOTO_MAX_WIDTH / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function uploadProgress(completed: number, total: number, elapsedMs: number) {
  return { completed, total, percent: total ? Math.floor(completed / total * 100) : 100,
    secondsRemaining: completed ? Math.ceil(elapsedMs / completed * (total - completed) / 1000) : null };
}

/** Synchronous lock: repeated calls share one operation, including the first draft creation. */
export function singleFlight<T>() {
  let pending: Promise<T> | null = null;
  return (work: () => Promise<T>): Promise<T> => {
    if (pending) return pending;
    pending = Promise.resolve().then(work).finally(() => { pending = null; });
    return pending;
  };
}

export function validateAnswers(questions: { id: string; pergunta: string }[], answers: Record<string, { resposta: string }>) {
  if (!questions.length) throw new Error("Não é permitido concluir auditoria sem perguntas válidas.");
  for (const q of questions) {
    if (!["SIM", "NÃO"].includes(answers[q.id]?.resposta)) throw new Error(`Resposta inválida ou ausente: ${q.pergunta}`);
  }
}