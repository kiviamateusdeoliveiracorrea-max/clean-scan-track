import { supabase } from "@/integrations/supabase/client";

export const NC_PHOTO_MAX_MB = 10;
export const NO_PERMISSION_MSG = "Você não possui permissão para incluir esta evidência.";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

function extOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Determina o MIME: usa o do navegador se válido, senão pela extensão. Nunca vazio. */
export function resolveImageMime(file: File): string | null {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (ALLOWED.has(t)) return t;
  const byExt = EXT_MIME[extOf(file.name)];
  return byExt ?? null;
}

/** Valida tipo e tamanho. Retorna mensagem amigável ou null se ok. */
export function validateNcPhoto(file: File): string | null {
  const mime = resolveImageMime(file);
  if (!mime) return `Formato não suportado: ${file.name}. Use JPG, JPEG, PNG, WEBP ou JFIF.`;
  if (file.size > NC_PHOTO_MAX_MB * 1024 * 1024)
    return `A foto ${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite é ${NC_PHOTO_MAX_MB} MB.`;
  return null;
}

/** Envia a foto com Content-Type explícito e confirma que ela existe. Retorna o caminho. */
export async function uploadNcPhoto(file: File, pathWithoutExt: string): Promise<string> {
  const invalid = validateNcPhoto(file);
  if (invalid) throw new Error(invalid);
  const mime = resolveImageMime(file)!;
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const path = `${pathWithoutExt}.${ext}`;
  const { error } = await supabase.storage
    .from("audit-photos")
    .upload(path, file, { contentType: mime, upsert: false });
  if (error) {
    console.error("[NC foto] upload falhou", { path, mime, size: file.size, error });
    const msg = String(error.message || "");
    if (/exceed|too large|size/i.test(msg))
      throw new Error(`A foto excede o limite de ${NC_PHOTO_MAX_MB} MB.`);
    if (/row-level|policy|unauthorized|403/i.test(msg)) throw new Error(NO_PERMISSION_MSG);
    throw new Error("Não foi possível enviar a foto: " + msg);
  }
  const { data, error: chk } = await supabase.storage.from("audit-photos").createSignedUrl(path, 60);
  if (chk || !data?.signedUrl) {
    console.error("[NC foto] confirmação falhou", { path, error: chk });
    await removeNcPhotos([path]);
    throw new Error("O envio da foto não pôde ser confirmado. Tente novamente.");
  }
  return path;
}

/** Remove arquivos recém-enviados (rollback). Registra falhas no console como órfão. */
export async function removeNcPhotos(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("audit-photos").remove(paths);
  if (error) console.error("[NC foto] ÓRFÃO — não foi possível remover", { paths, error });
}
