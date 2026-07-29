import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_MB } from "@/components/PhotoPicker";

/**
 * Envia as imagens para o bucket privado `audit-photos` e devolve os caminhos.
 * Lança Error com mensagem amigável em caso de falha.
 */
export async function uploadPhotos(files: File[], prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (const f of files) {
    const typeOk =
      ALLOWED_IMAGE_TYPES.includes(f.type) || /\.(jpe?g|png|webp|gif)$/i.test(f.name);
    if (!typeOk) throw new Error(`Formato não suportado: ${f.name}. Use JPG, PNG, WEBP ou GIF.`);
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024)
      throw new Error(`Arquivo ${f.name} excede ${MAX_UPLOAD_MB}MB.`);
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from("audit-photos").upload(path, f, {
      contentType: f.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });
    if (error) throw new Error("Erro no upload: " + error.message);
    paths.push(path);
  }
  return paths;
}
