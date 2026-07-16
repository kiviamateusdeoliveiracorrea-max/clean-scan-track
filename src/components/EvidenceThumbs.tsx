import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, FileImage, FileText, Loader2 } from "lucide-react";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic"];

function extOf(path: string) {
  return (path.split(".").pop() || "").toLowerCase();
}
function nameOf(path: string) {
  return path.split("/").pop() || path;
}
function isImage(path: string) {
  return IMAGE_EXT.includes(extOf(path));
}

type Entry = {
  path: string;
  url: string | null;
  error: string | null;
  loading: boolean;
};

export function EvidenceThumbs({
  paths,
  bucket = "audit-photos",
  showNames = true,
}: {
  paths: string[];
  bucket?: string;
  showNames?: boolean;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const p of paths) {
        if (entries[p]?.url || entries[p]?.error) continue;
        setEntries((s) => ({ ...s, [p]: { path: p, url: null, error: null, loading: true } }));
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(p, 3600);
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.error("[EvidenceThumbs] signedUrl error", { path: p, error });
          setEntries((s) => ({
            ...s,
            [p]: { path: p, url: null, error: error?.message ?? "Arquivo não encontrado", loading: false },
          }));
        } else {
          setEntries((s) => ({
            ...s,
            [p]: { path: p, url: data.signedUrl, error: null, loading: false },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|"), bucket]);

  if (paths.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {paths.map((p) => {
          const e = entries[p];
          const img = isImage(p);
          return (
            <div key={p} className="space-y-1">
              <div className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                {e?.loading && (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {e?.error && (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-destructive p-2 text-center gap-1">
                    <AlertCircle className="h-5 w-5" />
                    <span>Não foi possível carregar</span>
                  </div>
                )}
                {e?.url && img && (
                  <button
                    type="button"
                    onClick={() => setOpenUrl(e.url)}
                    className="w-full h-full"
                    aria-label="Ampliar foto"
                  >
                    <img
                      src={e.url}
                      alt={nameOf(p)}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setEntries((s) => ({
                          ...s,
                          [p]: { ...s[p], url: null, error: "Falha ao renderizar imagem" },
                        }))
                      }
                    />
                  </button>
                )}
                {e?.url && !img && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1 text-xs p-2 text-center"
                  >
                    <FileText className="h-8 w-8" />
                    <span className="truncate max-w-full">{nameOf(p)}</span>
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between gap-1">
                {showNames && (
                  <span className="text-[10px] text-muted-foreground truncate flex-1" title={nameOf(p)}>
                    {img ? <FileImage className="h-3 w-3 inline mr-1" /> : <FileText className="h-3 w-3 inline mr-1" />}
                    {nameOf(p)}
                  </span>
                )}
                {e?.url && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1"
                    title="Baixar evidência"
                  >
                    <a href={e.url} download={nameOf(p)} target="_blank" rel="noreferrer">
                      <Download className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={!!openUrl} onOpenChange={(o) => !o && setOpenUrl(null)}>
        <DialogContent className="max-w-4xl p-2">
          {openUrl && (
            <img src={openUrl} alt="Evidência ampliada" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
