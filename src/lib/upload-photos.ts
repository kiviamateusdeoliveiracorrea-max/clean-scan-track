import { supabase } from "@/integrations/supabase/client";
import { removeNcPhotos, uploadNcPhoto, validateNcPhoto } from "@/lib/nc-photo-upload";

/**
 * Envia as imagens para o bucket privado `audit-photos` (tipo sempre informado,
 * upload confirmado). Se qualquer uma falhar, remove as já enviadas neste lote.
 */
export async function uploadPhotos(files: File[], prefix: string): Promise<string[]> {
  for (const f of files) {
    const invalid = validateNcPhoto(f);
    if (invalid) throw new Error(invalid);
  }
  const paths: string[] = [];
  try {
    for (const f of files) {
      paths.push(
        await uploadNcPhoto(f, `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      );
    }
  } catch (e) {
    await rollbackUploads(paths, prefix, null, e);
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
  let ok = true;
  if (paths.length > 0) {
    const { error } = await supabase.storage.from("audit-photos").remove(paths);
    if (error) {
      ok = false;
      console.error("[evidência] ÓRFÃO — rollback falhou", { paths, error });
    }
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return ok;
  await supabase.from("evidence_upload_failures" as any).insert({
    user_id: data.user.id,
    context,
    record_id: recordId,
    paths,
    rollback_ok: ok,
    error_message: String((err as any)?.message ?? err ?? "").slice(0, 500),
  } as any);
  return ok;
}

export { removeNcPhotos };
