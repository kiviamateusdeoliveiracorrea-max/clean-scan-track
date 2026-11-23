import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Camera, MapPin, User, X } from "lucide-react";
import { EvidenceThumbs } from "@/components/EvidenceThumbs";
import { uploadAuditPhotos } from "@/lib/audit-photo-upload";
import { toast } from "sonner";

const ACAO_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  aberta: "bg-red-100 text-red-700",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-slate-100 text-slate-700",
};
const CARD_CLS: Record<string, string> = {
  aberta: "border-red-200 bg-red-50 text-red-700",
  em_andamento: "border-amber-200 bg-amber-50 text-amber-700",
  concluida: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelada: "border-slate-200 bg-slate-50 text-slate-700",
};
const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR") : "—");

export function AcoesProcessoTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("pendentes");
  const [tratando, setTratando] = useState<any | null>(null);
  const [texto, setTexto] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: acoesProcesso = [] } = useQuery({
    queryKey: ["acoes-processo-tratativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_processo")
        .select(
          "*, profiles:profiles!acoes_processo_responsavel_id_fkey(nome, cargo), tratador:profiles!acoes_processo_tratado_por_fkey(nome), perguntas_processo(pergunta), auditorias_processo(data_auditoria, areas(nome))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["acoes-processo-tratativas"] });
  };

  const setStatus = async (acao: any, status: string) => {
    const { data, error } = await supabase.from("acoes_processo").update({ status }).eq("id", acao.id).select("id");
    if (error || !data?.length) return toast.error(error?.message ?? "Sem permissão para alterar esta ação.");
    toast.success(status === "cancelada" ? "Ação cancelada." : "Ação em andamento.");
    refresh();
  };

  const close = () => {
    setTratando(null);
    setTexto("");
    setFiles([]);
  };

  const concluir = async () => {
    if (!tratando) return;
    if (!texto.trim()) return toast.error("Descreva a tratativa realizada.");
    setSaving(true);
    try {
      let caminhosEnviados: string[] = [];
      if (files.length) {
        caminhosEnviados = await uploadAuditPhotos(files, tratando.id, () => {}, new AbortController().signal);
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("acoes_processo")
        .update({
          tratativa: texto.trim(),
          evidencias: caminhosEnviados,
          status: "concluida",
          tratado_por: userData.user?.id ?? null,
          tratado_em: new Date().toISOString(),
        })
        .eq("id", tratando.id)
        .select("id");
      if (error || !data?.length) {
        if (caminhosEnviados.length) await supabase.storage.from("audit-photos").remove(caminhosEnviados);
        throw new Error(error?.message ?? "Sem permissão para concluir esta ação.");
      }
      toast.success("Ação concluída.");
      close();
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao concluir a ação.");
    } finally {
      setSaving(false);
    }
  };

  const lista = acoesProcesso.filter((a) =>
    filtro === "pendentes" ? a.status === "aberta" || a.status === "em_andamento" : filtro === "todos" || a.status === filtro,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["aberta", "em_andamento", "concluida", "cancelada"] as const).map((s) => {
          const count = acoesProcesso.filter((a) => a.status === s).length;
          const active = filtro === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(active ? "pendentes" : s)}
              className={`text-left rounded-lg border p-3 transition hover:brightness-95 ${CARD_CLS[s]} ${
                active ? "outline outline-2 outline-offset-1 outline-current" : ""
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide">
                {s === "aberta" ? "Abertas" : s === "em_andamento" ? "Em andamento" : s === "concluida" ? "Concluídas" : "Canceladas"}
              </p>
              <p className="text-2xl font-bold">{count}</p>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Mostrando:{" "}
          {filtro === "pendentes" ? "Abertas + Em andamento" : filtro === "todos" ? "Todas" : ACAO_STATUS_LABEL[filtro]} ({lista.length})
        </span>
        <Button size="sm" variant="ghost" onClick={() => setFiltro(filtro === "todos" ? "pendentes" : "todos")}>
          {filtro === "todos" ? "Ver pendentes" : "Ver todas"}
        </Button>
      </div>

      {lista.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma ação neste filtro.</CardContent></Card>
      )}

      {lista.map((acao) => (
        <Card key={acao.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{acao.auditorias_processo?.areas?.nome ?? "—"}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Auditoria {fmtDate(acao.auditorias_processo?.data_auditoria)}</span>
                </p>
                <p className="text-sm italic text-muted-foreground">
                  {acao.pergunta_id ? acao.perguntas_processo?.pergunta : "Sem pergunta vinculada"}
                </p>
              </div>
              <Badge className={STATUS_COLOR[acao.status] ?? ""}>{ACAO_STATUS_LABEL[acao.status] ?? acao.status}</Badge>
            </div>
            <p className="font-medium">{acao.o_que}</p>
            {acao.como && <p className="text-sm"><span className="text-muted-foreground">Como: </span>{acao.como}</p>}
            <p className="text-xs text-muted-foreground flex flex-wrap gap-3">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{acao.profiles?.nome ?? "Sem responsável"}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Prazo {fmtDate(acao.prazo)}</span>
            </p>

            {(acao.status === "aberta" || acao.status === "em_andamento") && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {acao.status === "aberta" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(acao, "em_andamento")}>Marcar em andamento</Button>
                )}
                <Button size="sm" onClick={() => setTratando(acao)}>Registrar tratativa</Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline ml-auto"
                  onClick={() => {
                    if (confirm("Cancelar esta ação? Essa ação não pode ser desfeita.")) setStatus(acao, "cancelada");
                  }}
                >
                  Cancelar ação
                </button>
              </div>
            )}

            {acao.status === "concluida" && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="text-sm"><span className="font-medium">Tratativa: </span>{acao.tratativa ?? "—"}</p>
                {acao.evidencias?.length > 0 && <EvidenceThumbs paths={acao.evidencias} />}
                <p className="text-xs text-muted-foreground">
                  Concluída por {acao.tratador?.nome ?? "—"} em {acao.tratado_em ? new Date(acao.tratado_em).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!tratando} onOpenChange={(o) => !o && !saving && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar tratativa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{tratando?.o_que}</p>
            <div className="space-y-1">
              <Label>Descreva o que foi realizado (tratativa) *</Label>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Evidências (opcional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" />Adicionar fotos
              </Button>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>Voltar</Button>
            <Button onClick={concluir} disabled={saving}>{saving ? "Salvando..." : "Concluir ação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
