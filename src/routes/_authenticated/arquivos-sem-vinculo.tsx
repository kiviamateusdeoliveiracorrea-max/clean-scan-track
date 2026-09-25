import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listOrphanFiles } from "@/lib/orphan-files.functions";

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

function fmtSize(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

function Page() {
  const fn = useServerFn(listOrphanFiles);
  const q = useQuery({ queryKey: ["orphan-files"], queryFn: () => fn(), retry: false, staleTime: 0 });

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-6xl mx-auto">
      <div>
        <p className="text-xs text-muted-foreground">Administração</p>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Arquivos sem vínculo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Somente leitura. Nenhum arquivo é movido ou excluído por esta tela.
        </p>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && !q.data.allowed && (
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
      )}
      {q.data?.allowed && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Arquivos no armazenamento", q.data.total],
              ["Sem vínculo", q.data.rows.length],
              ["Falhas de envio registradas", q.data.failures],
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
              <CardTitle className="text-base">Lista ({q.data.rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Caminho</th><th className="p-2">Tamanho</th><th className="p-2">Data</th>
                    <th className="p-2">Tipo</th><th className="p-2">Possível origem</th><th className="p-2">Status</th>
                    <th className="p-2">Ação sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.map((r) => (
                    <tr key={r.path} className="border-t">
                      <td className="p-2 font-mono break-all">{r.path}</td>
                      <td className="p-2 whitespace-nowrap">{fmtSize(r.size)}</td>
                      <td className="p-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2">{r.mime ?? "—"}</td>
                      <td className="p-2">{r.origem}</td>
                      <td className="p-2"><Badge variant="secondary">{r.status}</Badge></td>
                      <td className="p-2">{r.acao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
