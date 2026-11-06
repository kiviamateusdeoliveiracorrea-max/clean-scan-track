import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useProcessAuditManager } from "@/hooks/use-process-audit-permission";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ArrowLeft, Calendar, MapPin, User, Camera, FileImage, FileText, Clock, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { classificaPontuacao } from "@/lib/audit-constants";

/** Visualização de fotos do bucket audit-photos com URL assinada (mesmo padrão de auditorias.$id.tsx). */
function AuditPhotos({ paths }: { paths: string[] }) {
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

export const Route = createFileRoute("/_authenticated/auditorias-processo/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da Auditoria de Processo — AuditLog 5S" },
      { name: "description", content: "Respostas por pilar, notas e ações da auditoria de processo." },
      { property: "og:title", content: "Detalhe da Auditoria de Processo — AuditLog 5S" },
      { property: "og:description", content: "Respostas por pilar, notas e ações da auditoria de processo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaProcessoDetail,
});

const PILARES = ["Pessoas", "Ambiente", "Processo"] as const;

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  concluida: "Concluída",
};

const ACAO_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function AuditoriaProcessoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: audit } = useQuery({
    queryKey: ["auditoria-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias_processo")
        .select("*, areas(nome, setor), auditores(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Registro inexistente ou de outra unidade/área: registra a tentativa bloqueada.
        try {
          await (supabase.rpc as any)("log_access_denied", {
            _entity: "auditorias_processo", _entity_id: id, _detail: "Abertura por URL sem acesso",
          });
        } catch { /* registro não bloqueia a tela */ }
        throw new Error("Auditoria de processo não encontrada ou sem acesso para sua unidade/área.");
      }
      return data;
    },
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["respostas-processo", id],
    enabled: !!audit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("respostas_processo")
        .select("*, perguntas_processo(pergunta, categoria, ordem)")
        .eq("auditoria_processo_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ["acoes-processo", id],
    enabled: !!audit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_processo")
        .select("*, profiles(nome)")
        .eq("auditoria_processo_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const canManage = useProcessAuditManager([audit?.auditor_id]);

  if (!audit) {
    return <div className="p-8">Carregando...</div>;
  }

  const concluida = audit.status === "concluida";
  const cls = concluida && audit.nota_final != null ? classificaPontuacao(Number(audit.nota_final)) : null;

  const porPilar = PILARES.map((pilar) => ({
    pilar,
    itens: respostas
      .filter((r: any) => r.perguntas_processo?.categoria === pilar)
      .sort((a: any, b: any) => (a.perguntas_processo?.ordem ?? 0) - (b.perguntas_processo?.ordem ?? 0)),
  })).filter((g) => g.itens.length > 0);

  const notasPilares = [
    { label: "Pessoas", v: audit.nota_pessoas },
    { label: "Ambiente", v: audit.nota_ambiente },
    { label: "Processo", v: audit.nota_processo },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auditorias-processo">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          {concluida && canManage(audit.auditor_id) && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/auditorias-processo/$id/editar" params={{ id }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Excluir esta auditoria de processo? Essa ação não pode ser desfeita e remove os dados dos indicadores do dashboard.")) return;
                  const { data: removed, error } = await supabase.from("auditorias_processo").delete().eq("id", id).select("id");
                  if (error || !removed?.length) return void toast.error(error?.message ?? "Sem permissão para excluir esta auditoria.");
                  toast.success("Auditoria excluída");
                  navigate({ to: "/auditorias-processo" });
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
              <MapPin className="h-6 w-6 text-accent" />
              {(audit as any).areas?.nome ?? "Sem área"}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(audit.data_auditoria).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {(audit as any).auditores?.nome ?? "—"}
              </span>
              {(audit as any).turno && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {(audit as any).turno}
                </span>
              )}
              {audit.colaborador_auditado && (
                <span>Colaborador: {audit.colaborador_auditado}</span>
              )}
              {audit.documento_referencia && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {audit.documento_referencia}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{STATUS_LABEL[audit.status] ?? audit.status}</Badge>
            {cls && (
              <Badge className={`${cls.color} border-0 font-bold text-lg px-4 py-2`}>
                {Number(audit.nota_final).toFixed(0)}% · {cls.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {concluida && (
        <div className="grid grid-cols-3 gap-3">
          {notasPilares.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-accent uppercase">{s.label}</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {s.v != null ? `${Number(s.v).toFixed(0)}%` : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {audit.processo_claro !== null && audit.processo_claro !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encerramento — o processo está claro?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Badge className={audit.processo_claro ? "bg-emerald-100 text-emerald-700 border-0" : "bg-red-100 text-red-700 border-0"}>
              {audit.processo_claro ? "Sim, está claro" : "Não, ainda há dúvidas"}
            </Badge>
            {audit.processo_claro_observacao && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-1">
                {audit.processo_claro_observacao}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {audit.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{audit.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(audit.fotos) && audit.fotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" /> Fotos da auditoria ({audit.fotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditPhotos paths={audit.fotos as string[]} />
          </CardContent>
        </Card>
      )}

      {porPilar.map((g) => (
        <Card key={g.pilar}>
          <CardHeader>
            <CardTitle className="text-base">{g.pilar} ({g.itens.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.itens.map((r: any) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium flex-1">{r.perguntas_processo?.pergunta ?? "Pergunta removida"}</p>
                  <Badge className={r.resposta === "SIM" ? "bg-emerald-100 text-emerald-700 border-0 shrink-0" : r.resposta === "NA" ? "bg-slate-100 text-slate-600 border-0 shrink-0" : "bg-red-100 text-red-700 border-0 shrink-0"}>
                    {r.resposta === "NA" ? "N/A" : r.resposta}
                  </Badge>
                </div>
                {r.observacao && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.observacao}</p>
                )}
                {r.oportunidade_melhoria && (
                  <p className="text-xs whitespace-pre-wrap flex items-start gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <span><strong>Oportunidade de melhoria:</strong> {r.oportunidade_melhoria}</span>
                  </p>
                )}
                {r.foto_url && <AuditPhotos paths={[r.foto_url]} />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações ({acoes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {acoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma ação registrada.
            </p>
          ) : (
            <div className="space-y-3">
              {acoes.map((a: any) => (
                <div key={a.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium flex-1">{a.o_que}</p>
                    <Badge variant="outline" className="shrink-0">
                      {ACAO_STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </div>
                  {a.como && <p className="text-sm text-muted-foreground">{a.como}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Quem: {(a as any).profiles?.nome ?? "—"}</span>
                    {a.prazo && (
                      <span>Quando: {new Date(a.prazo).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
