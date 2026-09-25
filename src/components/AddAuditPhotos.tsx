import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadPhotos, rollbackUploads } from "@/lib/upload-photos";

/** Adiciona fotos gerais a uma auditoria existente: envia → confirma → grava; desfaz se a gravação falhar. */
export function AddAuditPhotos({
  auditoriaId,
  onDone,
}: {
  auditoriaId: string;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (files.length === 0) return;
    setSaving(true);
    let sent: string[] = [];
    try {
      sent = await uploadPhotos(files, auditoriaId, "auditoria-fotos-gerais", auditoriaId);
      // Lê a lista atual para não sobrescrever fotos gravadas por outra pessoa.
      const { data: cur, error: e1 } = await supabase
        .from("auditorias")
        .select("fotos")
        .eq("id", auditoriaId)
        .single();
      if (e1) throw e1;
      const { data: upd, error } = await supabase
        .from("auditorias")
        .update({ fotos: [...((cur?.fotos as string[]) ?? []), ...sent] })
        .eq("id", auditoriaId)
        .select("id");
      if (error) throw error;
      if (!upd || upd.length === 0) throw new Error("Você não possui permissão para alterar esta auditoria.");
      toast.success(`${sent.length} foto(s) adicionada(s).`);
      setFiles([]);
      onDone();
    } catch (e: any) {
      if (sent.length) {
        await rollbackUploads(sent, "auditoria-fotos-gerais", auditoriaId, e);
        toast.error("Não foi possível salvar. As fotos enviadas foram descartadas. " + (e?.message ?? ""));
      } else toast.error(e?.message ?? "Erro no envio das fotos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <PhotoPicker label="Adicionar fotos (JPG, PNG, WEBP, JFIF, HEIC — até 10 MB)" files={files} onChange={setFiles} />
      {files.length > 0 && (
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Enviando…" : "Salvar fotos"}
        </Button>
      )}
    </div>
  );
}
