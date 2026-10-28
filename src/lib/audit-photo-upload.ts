import { supabase } from "@/integrations/supabase/client";
import { resolveImageMime, validateNcPhoto } from "./nc-photo-upload";
import { PHOTO_MAX_WIDTH, PHOTO_TARGET_MB, uploadProgress } from "./audit-save-flow";

export async function compressAuditPhoto(file: File, signal?: AbortSignal) {
  const invalid = validateNcPhoto(file);
  if (invalid) throw new Error(invalid);
  const mime = resolveImageMime(file);
  // HEIC is kept intact when the browser cannot decode it; never discard evidence.
  if (mime === "image/heic") return file;
  const { default: compress } = await import("browser-image-compression");
  const normalized = new File([file], file.name, { type: mime ?? file.type });
  return compress(normalized, { maxSizeMB: PHOTO_TARGET_MB, maxWidthOrHeight: PHOTO_MAX_WIDTH,
    initialQuality: 0.85, maxIteration: 4, useWebWorker: false, fileType: "image/jpeg", signal });
}

export async function uploadAuditPhotos(files: File[], prefix: string, onProgress: (p: ReturnType<typeof uploadProgress>) => void, signal: AbortSignal) {
  const paths: string[] = [];
  const start = Date.now();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sua sessão terminou. Entre novamente para enviar as fotos.");
  onProgress(uploadProgress(0, files.length, 0));
  try {
    for (const original of files) {
      signal.throwIfAborted();
      const file = await compressAuditPhoto(original, signal);
      const mime = resolveImageMime(file);
      if (!mime) throw new Error("Formato de foto inválido.");
      const path = `${prefix}/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`;
      // Include attempted paths: a lost response may still have created the object.
      paths.push(path);
      const timeout = AbortSignal.timeout(120000);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/audit-photos/${path}`, {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": mime, "x-upsert": "false" },
        body: file, signal: AbortSignal.any([signal, timeout]),
      });
      if (!response.ok) throw new Error(`Não foi possível enviar a foto ${paths.length} (${response.status}).`);
      const { data: check, error: checkError } = await supabase.storage.from("audit-photos").createSignedUrl(path, 60);
      if (checkError || !check?.signedUrl) throw new Error(`Não foi possível confirmar a foto ${paths.length}.`);
      onProgress(uploadProgress(paths.length, files.length, Date.now() - start));
    }
    return paths;
  } catch (error) {
    const { rollbackUploads } = await import("./upload-photos");
    await rollbackUploads(paths, "auditoria-fotos-gerais", prefix, error);
    throw error;
  }
}