import { useEffect, useState } from "react";
import { Camera, ImagePlus, X, FileImage } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Fotos opcionais de uma pergunta: câmera ou galeria, várias por pergunta, prévia e remoção. */
export function QuestionPhotos({
  paths,
  onAdd,
  onRemove,
  busy,
  disabled,
}: {
  paths: string[];
  onAdd: (files: File[]) => void;
  onRemove: (path: string) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    paths.forEach(async (p) => {
      if (urls[p]) return;
      const { data } = await supabase.storage.from("audit-photos").createSignedUrl(p, 3600);
      if (data?.signedUrl) setUrls((u) => ({ ...u, [p]: data.signedUrl }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|")]);

  const pick = (list: FileList | null) => {
    if (list && list.length) onAdd(Array.from(list));
  };
  const btn = "inline-flex items-center gap-1 text-xs border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <label className={btn} aria-disabled={disabled}>
          <Camera className="h-4 w-4" /> Tirar foto
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled}
            onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={btn} aria-disabled={disabled}>
          <ImagePlus className="h-4 w-4" /> Adicionar foto
          <input type="file" multiple disabled={disabled}
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,.jpg,.jpeg,.jfif,.png,.webp,.heic"
            className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
        {busy && <span className="text-[11px] text-muted-foreground">enviando foto...</span>}
        {paths.length > 0 && <span className="text-[11px] text-muted-foreground">{paths.length} foto(s)</span>}
      </div>
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {paths.map((p) => (
            <div key={p} className="relative h-16 w-16 rounded border overflow-hidden bg-muted">
              {urls[p] ? (
                <a href={urls[p]} target="_blank" rel="noreferrer">
                  <img src={urls[p]} alt="Evidência da pergunta" className="h-full w-full object-cover" />
                </a>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground"><FileImage className="h-5 w-5" /></div>
              )}
              {!disabled && (
                <button type="button" onClick={() => onRemove(p)} aria-label="Remover foto"
                  className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 text-destructive border">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
