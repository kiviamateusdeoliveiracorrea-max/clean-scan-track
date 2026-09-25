import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listOrphanFiles, reviewOrphanFile, type OrphanRow } from "@/lib/orphan-files.functions";

export const Route = createFileRoute("/_authenticated/arquivos-sem-vinculo")({
  head: () => ({
    meta: [
      { title: "Arquivos sem vínculo — Administração 5S" },
      { name: "description", content: "Relatório administrativo de evidências sem vínculo com registros." },
      { property: "og:title", content: "Arquivos sem vínculo — Administração 5S" },
      { property: "og:description", content: "Monitoramento de arquivos órfãos de evidências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Action = "MANTER" | "ARQUIVAR" | "VINCULAR" | "EXCLUIR";
const LABEL: Record<Action, string> = { MANTER: "Manter", ARQUIVAR: "Arquivar", VINCULAR: "Vincular", EXCLUIR: "Excluir após validação" };

function fmtSize(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

function Page() {
  const fn = useServerFn(listOrphanFiles);
  const review = useServerFn(reviewOrphanFile);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["orphan-files"], queryFn: () => fn(), retry: false, staleTime: 0 });
  const [dlg, setDlg] = useState<{ row: OrphanRow; action: Action } | null>(null);
  const [just, setJust] = useState("");
  const [audId, setAudId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fBusca, setFBusca] = useState("");

  const open = (row: OrphanRow, action: Action) => {
    setDlg({ row, action });
    setJust("");
    setConfirm("");
    setAudId(row.relacionadoId ?? "");
  };

  const submit = async () => {
    if (!dlg) return;
    setBusy(true);
    try {
      await review({
        data: {
          path: dlg.row.path,
          action: dlg.action,
          justification: just,
          auditoriaId: dlg.action === "VINCULAR" ? audId.trim() || undefined : undefined,
          confirm: dlg.action === "EXCLUIR" ? confirm : undefined,
        },
      });
      toast.success("Decisão registrada.");
      setDlg(null);
      qc.invalidateQueries({ queryKey: ["orphan-files"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  };

  const rowsF = (q.data?.rows ?? []).filter(
    (r) =>
      (!fStatus || r.status === fStatus) &&
      (!fOrigem || r.origem === fOrigem) &&
      (!fBusca || (r.path + r.name).toLowerCase().includes(fBusca.toLowerCase())),
  );

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-7xl mx-auto">
      <div>
        <p className="text-xs text-muted-foreground">Administração</p>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Arquivos sem vínculo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nada é excluído automaticamente. Toda decisão exige justificativa e fica registrada.
        </p>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && !q.data.allowed && <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>}
      {q.data?.allowed && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Arquivos no armazenamento", q.data.total],
              ["Sem vínculo", q.data.rows.length],
              ["Falhas de envio registradas", q.data.failures],
              ["Eventos de evidência", q.data.events],
            ].map(([l, v]) => (
              <Card key={l as string}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="text-xl font-bold">{v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lista ({rowsF.length})</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Input aria-label="Buscar" placeholder="Buscar por nome ou caminho" value={fBusca} onChange={(e) => setFBusca(e.target.value)} className="h-8 w-56 text-xs" />
                <select aria-label="Filtrar status" className="h-8 rounded-md border bg-background px-2 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  {[...new Set(q.data.rows.map((r) => r.status))].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select aria-label="Filtrar origem" className="h-8 rounded-md border bg-background px-2 text-xs" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
                  <option value="">Todas as origens</option>
                  {[...new Set(q.data.rows.map((r) => r.origem))].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Nome</th><th className="p-2">Caminho</th><th className="p-2">Tamanho</th>
                    <th className="p-2">Criado em</th><th className="p-2">Tipo</th><th className="p-2">Possível registro</th>
                    <th className="p-2">Status</th><th className="p-2">Ação sugerida</th><th className="p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsF.map((r) => (
                    <tr key={r.path} className="border-t align-top">
                      <td className="p-2 break-all">{r.name}</td>
                      <td className="p-2 font-mono break-all text-muted-foreground">{r.path}</td>
                      <td className="p-2 whitespace-nowrap">{fmtSize(r.size)}</td>
                      <td className="p-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2">{r.mime ?? "—"}</td>
                      <td className="p-2">{r.relacionado ?? r.origem}</td>
                      <td className="p-2">
                        <Badge variant="secondary">{r.status}</Badge>
                        {r.justificativa && <p className="text-[10px] text-muted-foreground mt-1">{r.justificativa}</p>}
                      </td>
                      <td className="p-2">{r.acao}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {(["VINCULAR", "MANTER", "ARQUIVAR", "EXCLUIR"] as Action[]).map((a) => (
                            <Button key={a} size="sm" variant={a === "EXCLUIR" ? "destructive" : "outline"} className="h-6 px-2 text-[10px]" onClick={() => open(r, a)}>
                              {LABEL[a]}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg ? LABEL[dlg.action] : ""}</DialogTitle>
          </DialogHeader>
          {dlg && (
            <div className="space-y-3 text-sm">
              <p className="font-mono text-xs break-all text-muted-foreground">{dlg.row.path}</p>
              {dlg.action === "VINCULAR" && (
                <div className="space-y-1">
                  <Label>ID da auditoria</Label>
                  <Input value={audId} onChange={(e) => setAudId(e.target.value)} placeholder="Identificador da auditoria" />
                </div>
              )}
              {dlg.action === "EXCLUIR" && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive">Só é permitido para arquivos já marcados como Mantido ou Arquivado. A exclusão é definitiva.</p>
                  <Label>Digite EXCLUIR para confirmar</Label>
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label>Justificativa</Label>
                <Textarea value={just} onChange={(e) => setJust(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={busy || just.trim().length < 5}>{busy ? "Salvando…" : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
