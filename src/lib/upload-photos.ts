import { supabase } from "@/integrations/supabase/client";
import { removeNcPhotos, resolveImageMime, uploadNcPhoto, validateNcPhoto } from "@/lib/nc-photo-upload";

type EvEvent = "UPLOAD_REALIZADO" | "UPLOAD_CANCELADO" | "ROLLBACK_EXECUTADO" | "FALHA_GRAVACAO";

/** Registra um evento de evidência (nunca o conteúdo do arquivo). Falhas no registro não interrompem o fluxo. */
export async function logEvidenceEvent(e: {
  event: EvEvent;
  context: string;
  recordId?: string | null;
  path?: string | null;
  mime?: string | null;
  size?: number | null;
  result: string;
  detail?: string | null;
}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("evidence_events" as any).insert({
      user_id: data.user.id,
      event: e.event,
      context: e.context,
      record_id: e.recordId ?? null,
      path: e.path ?? null,
      mime: e.mime ?? null,
      size_bytes: e.size ?? null,
      result: e.result,
      detail: e.detail ? String(e.detail).slice(0, 500) : null,
    } as any);
  } catch (err) {
    console.error("[evidência] não foi possível registrar evento", err);
  }
}

/**
 * Envia as imagens para o bucket privado `audit-photos` (tipo sempre informado,
 * upload confirmado). Se qualquer uma falhar, remove as já enviadas neste lote.
 */
export async function uploadPhotos(
  files: File[],
  prefix: string,
  context = prefix.split("/")[0] || "evidencia",
  recordId: string | null = null,
): Promise<string[]> {
  for (const f of files) {
    const invalid = validateNcPhoto(f);
    if (invalid) {
      await logEvidenceEvent({ event: "UPLOAD_CANCELADO", context, recordId, mime: f.type || null, size: f.size, result: "BLOQUEADO_VALIDACAO", detail: invalid });
      throw new Error(invalid);
    }
  }
  const paths: string[] = [];
  try {
    for (const f of files) {
      const p = await uploadNcPhoto(f, `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      paths.push(p);
      await logEvidenceEvent({ event: "UPLOAD_REALIZADO", context, recordId, path: p, mime: resolveImageMime(f), size: f.size, result: "OK" });
    }
  } catch (e) {
    await rollbackUploads(paths, context, recordId, e);
    throw e;
  }
  return paths;
}

/** Remove arquivos recém-enviados e registra a tentativa (sem dados sensíveis). */
export async function rollbackUploads(
  paths: string[],
  context: string,
  recordId: string | null,
  err: unknown,
) {
  const msg = String((err as any)?.message ?? err ?? "").slice(0, 500);
  await logEvidenceEvent({ event: "FALHA_GRAVACAO", context, recordId, result: "ERRO", detail: msg });
  let ok = true;
  if (paths.length > 0) {
    const { error } = await supabase.storage.from("audit-photos").remove(paths);
    if (error) {
      ok = false;
      console.error("[evidência] ÓRFÃO — rollback falhou", { paths, error });
    }
    for (const p of paths)
      await logEvidenceEvent({ event: "ROLLBACK_EXECUTADO", context, recordId, path: p, result: ok ? "REMOVIDO" : "FALHOU_ORFAO" });
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return ok;
  await supabase.from("evidence_upload_failures" as any).insert({
    user_id: data.user.id,
    context,
    record_id: recordId,
    paths,
    rollback_ok: ok,
    error_message: msg,
  } as any);
  return ok;
}

export { removeNcPhotos };
