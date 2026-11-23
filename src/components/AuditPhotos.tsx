import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileImage } from "lucide-react";

export function AuditPhotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const loadUrl = async (path: string) => {
    if (urls[path]) return urls[path];
    const { data } = await supabase.storage
      .from("audit-photos")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setUrls((u) => ({ ...u, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  useEffect(() => {
    paths.forEach((p) => void loadUrl(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|")]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {paths.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => urls[p] && setOpen(urls[p])}
            className="relative aspect-square rounded-md overflow-hidden border bg-muted"
          >
            {urls[p] ? (
              <img src={urls[p]} alt="Foto da auditoria" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <FileImage className="h-6 w-6" />
              </div>
            )}
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          {open && <img src={open} alt="Foto" className="w-full h-auto rounded-md" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
