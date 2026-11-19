import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { UserPickerField } from "@/components/UserPickerField";
import { QuestionPhotos } from "@/components/QuestionPhotos";
import { uploadAuditPhotos } from "@/lib/audit-photo-upload";
import { toast } from "sonner";
import { useProcessAuditManager } from "@/hooks/use-process-audit-permission";
import { useCurrentRole } from "@/hooks/use-current-role";

export const Route = createFileRoute("/_authenticated/auditorias-processo/$id_/editar")({
  head: () => ({
    meta: [
      { title: "Editar Auditoria de Processo — AuditLog 5S" },
      { name: "description", content: "Correção de respostas e dados de uma auditoria de processo concluída." },
      { property: "og:title", content: "Editar Auditoria de Processo — AuditLog 5S" },
      { property: "og:description", content: "Correção de respostas e dados de uma auditoria de processo concluída." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditarAuditoriaProcesso,
});

const CATEGORIAS = ["Pessoas", "Ambiente", "Processo"] as const;
const PERGUNTA_ENCERRAMENTO =
  "Está clara a forma com que devem ser seguidos os processos bem como os impactos que o seu não-seguimento causam na nossa operação?";
type Resp = "SIM" | "NÃO" | "NA";
type Acao = { id?: string; oQue: string; como: string; responsavelId: string; prazo: string; status: string };
type Item = { resposta: Resp; observacao: string; fotoPaths: string[]; enviando?: boolean; acao?: Acao };
const acaoVazia: Acao = { oQue: "", como: "", responsavelId: "", prazo: "", status: "aberta" };

function EditarAuditoriaProcesso() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLoading: roleLoading } = useCurrentRole();

  const auditQ = useQuery({
    queryKey: ["auditoria-processo-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias_processo")
        .select("*, areas(nome), auditores(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const audit: any = auditQ.data;

  const perguntasQ = useQuery({
    queryKey: ["perguntas-processo-edit", id],
    enabled: !!audit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("respostas_processo")
        .select("*, perguntas_processo(id, pergunta, categoria, ordem)")
        .eq("auditoria_processo_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const acoesQ = useQuery({
    queryKey: ["acoes-processo-edit", id],
    enabled: !!audit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_processo")
        .select("id, pergunta_id, o_que, como, responsavel_id, prazo, status")
        .eq("auditoria_processo_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usuariosQ = useQuery({
    queryKey: ["profiles-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo, areas(nome)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const canManage = useProcessAuditManager([audit?.auditor_id]);

  const [colaborador, setColaborador] = useState("");
  const [documento, setDocumento] = useState("");
  const [data, setData] = useState("");
  const [turno, setTurno] = useState("");
  const [processoClaro, setProcessoClaro] = useState<boolean | null>(null);
  const [processoClaroObs, setProcessoClaroObs] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<Record<string, Item>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!audit) return;
    setColaborador(audit.colaborador_auditado ?? "");
    setDocumento(audit.documento_referencia ?? "");
    setData(audit.data_auditoria ?? "");
    setTurno(audit.turno ?? "");
    setProcessoClaro(audit.processo_claro ?? null);
    setProcessoClaroObs(audit.processo_claro_observacao ?? "");
    setObservacoes(audit.observacoes ?? "");
  }, [audit]);

  useEffect(() => {
    const map: Record<string, Item> = {};
    for (const r of (perguntasQ.data ?? []) as any[]) {
      map[r.pergunta_id] = {
        resposta: r.resposta,
        observacao: r.observacao ?? "",
        fotoPaths: (r.foto_urls?.length ? r.foto_urls : r.foto_url ? [r.foto_url] : []) as string[],
      };
      const a: any = (acoesQ.data ?? []).find((x: any) => x.pergunta_id === r.pergunta_id);
      if (a) map[r.pergunta_id].acao = {
        id: a.id, oQue: a.o_que ?? "", como: a.como ?? "", responsavelId: a.responsavel_id ?? "",
        prazo: a.prazo ?? "", status: a.status ?? "aberta",
      };
    }
    setItens(map);
  }, [perguntasQ.data, acoesQ.data]);

  const voltar = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/auditorias-processo/$id" params={{ id }}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>
    </Button>
  );

  if (auditQ.isLoading || roleLoading || canManage.loading) return <div className="p-8">Carregando...</div>;
  if (!audit || audit.status !== "concluida" || !canManage(audit.auditor_id)) {
    return (
      <div className="p-8 space-y-3">
        {voltar}
        <p className="text-sm text-muted-foreground">
          {!audit
            ? "Auditoria não encontrada ou sem acesso."
            : audit.status !== "concluida"
              ? "Esta auditoria ainda é um rascunho. Use a tela de preenchimento."
              : "Você não tem permissão para editar esta auditoria."}
        </p>
      </div>
    );
  }

  const perguntas = ((perguntasQ.data ?? []) as any[])
    .map((r) => r.perguntas_processo)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const patch = (pid: string, p: Partial<Item>) =>
    setItens((s) => ({ ...s, [pid]: { ...s[pid], ...p } }));

  const addFotos = async (pid: string, files: File[]) => {
    patch(pid, { enviando: true });
    try {
      const novos = await uploadAuditPhotos(files, id, () => undefined, new AbortController().signal);
      setItens((s) => ({ ...s, [pid]: { ...s[pid], enviando: false, fotoPaths: [...s[pid].fotoPaths, ...novos] } }));
    } catch (e: any) {
      toast.error(e?.message ?? "O envio da foto foi interrompido.");
      patch(pid, { enviando: false });
    }
  };

  const salvar = async () => {
    if (!turno) return void toast.error("Selecione o turno");
    if (processoClaro === null) return void toast.error("Responda a pergunta de encerramento.");
    const semAcao = perguntas.find((p: any) => itens[p.id]?.resposta === "NÃO" && !itens[p.id]?.acao?.oQue.trim());
    if (semAcao) return void toast.error('Preencha a ação ("O que será feito") para a pergunta: ' + semAcao.pergunta);
    const incompleta = Object.values(itens).some(
      (it) => it.resposta === "NÃO" && it.acao && !it.acao.oQue.trim() && (it.acao.como.trim() || it.acao.responsavelId || it.acao.prazo),
    );
    if (incompleta) return void toast.error('Preencha o campo "O que" em todas as linhas do plano de ação ou remova a linha.');
    setSaving(true);
    const { error } = await (supabase.rpc as any)("edit_completed_audit_processo", {
      p_id: id,
      p_audit: {
        area_id: audit.area_id,
        unit_id: audit.unit_id,
        colaborador_auditado: colaborador || null,
        documento_referencia: documento || null,
        data_auditoria: data,
        turno,
        processo_claro: processoClaro,
        processo_claro_observacao: processoClaroObs || null,
        observacoes: observacoes || null,
      },
      p_answers: Object.entries(itens).map(([pergunta_id, it]) => ({
        pergunta_id,
        resposta: it.resposta,
        observacao: it.observacao || null,
        foto_urls: it.fotoPaths,
      })),
      p_acoes: [
        // Ações antigas sem pergunta vinculada são mantidas como estão.
        ...((acoesQ.data ?? []) as any[]).filter((a) => !a.pergunta_id).map((a) => ({
          id: a.id, o_que: a.o_que, como: a.como, responsavel_id: a.responsavel_id, prazo: a.prazo, status: a.status,
        })),
        ...Object.entries(itens)
          .filter(([, it]) => it.resposta === "NÃO" && it.acao?.oQue.trim())
          .map(([pergunta_id, it]) => ({
            id: it.acao!.id ?? null,
            pergunta_id,
            o_que: it.acao!.oQue.trim(),
            como: it.acao!.como.trim() || null,
            responsavel_id: it.acao!.responsavelId || null,
            prazo: it.acao!.prazo || null,
            status: it.acao!.status || "aberta",
          })),
      ],
    });
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("Auditoria atualizada");
    qc.invalidateQueries({ queryKey: ["auditoria-processo", id] });
    qc.invalidateQueries({ queryKey: ["respostas-processo", id] });
    qc.invalidateQueries({ queryKey: ["acoes-processo", id] });
    qc.invalidateQueries({ queryKey: ["acoes-processo-edit", id] });
    qc.invalidateQueries({ queryKey: ["auditorias-processo-list"] });
    navigate({ to: "/auditorias-processo/$id", params: { id } });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        {voltar}
        <h1 className="text-2xl font-bold text-primary mt-2">
          Editar auditoria — {audit.areas?.nome ?? "Sem área"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Auditor: {audit.auditores?.nome ?? "—"}. Área, unidade e fotos gerais não são alterados aqui.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados gerais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1º Turno">1º Turno</SelectItem>
                <SelectItem value="2º Turno">2º Turno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Colaborador auditado</Label>
            <Input value={colaborador} onChange={(e) => setColaborador(e.target.value)} />
          </div>
          <div>
            <Label>Documento de referência (opcional)</Label>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {perguntasQ.isLoading && <p className="text-sm text-muted-foreground">Carregando perguntas...</p>}
          {CATEGORIAS.map((cat) => {
            const lista = perguntas.filter((p: any) => p.categoria === cat);
            if (!lista.length) return null;
            return (
              <div key={cat} className="space-y-3">
                <h3 className="font-semibold text-primary border-b pb-1">{cat}</h3>
                {lista.map((p: any, i: number) => {
                  const r = itens[p.id];
                  if (!r) return null;
                  return (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">{i + 1}. {p.pergunta}</p>
                      <div className="flex gap-2">
                        {(["SIM", "NÃO", "NA"] as const).map((op) => (
                          <Button
                            key={op}
                            type="button"
                            size="sm"
                            variant={r.resposta === op ? "default" : "outline"}
                            className={
                              r.resposta === op && op === "NÃO"
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : r.resposta === op && op === "NA"
                                  ? "bg-muted-foreground/30 text-foreground hover:bg-muted-foreground/40"
                                  : ""
                            }
                            onClick={() => patch(p.id, { resposta: op })}
                          >
                            {op === "SIM" ? "Sim" : op === "NÃO" ? "Não" : "N/A"}
                          </Button>
                        ))}
                      </div>
                      <Textarea
                        rows={1}
                        placeholder="Observação (opcional)..."
                        value={r.observacao}
                        onChange={(e) => patch(p.id, { observacao: e.target.value })}
                      />
                      <QuestionPhotos
                        paths={r.fotoPaths}
                        busy={r.enviando}
                        onAdd={(files) => addFotos(p.id, files)}
                        onRemove={(path) => patch(p.id, { fotoPaths: r.fotoPaths.filter((x) => x !== path) })}
                      />
                      {r.resposta === "NÃO" && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 dark:border-amber-700 dark:bg-amber-950/30">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Ação para esta não conformidade (obrigatório)</p>
                          <Label className="text-xs">O que será feito *</Label>
                          <Textarea rows={1} placeholder="O que será feito..." value={r.acao?.oQue ?? ""}
                            onChange={(e) => patch(p.id, { acao: { ...(r.acao ?? acaoVazia), oQue: e.target.value } })} />
                          <Textarea rows={1} placeholder="Como (opcional)..." value={r.acao?.como ?? ""}
                            onChange={(e) => patch(p.id, { acao: { ...(r.acao ?? acaoVazia), como: e.target.value } })} />
                          <div className="grid gap-2 sm:grid-cols-3">
                            <UserPickerField label="Quem" value={r.acao?.responsavelId ?? ""}
                              onChange={(v) => patch(p.id, { acao: { ...(r.acao ?? acaoVazia), responsavelId: v } })}
                              users={(usuariosQ.data ?? []) as any} />
                            <div>
                              <Label className="text-xs">Quando (opcional)</Label>
                              <Input type="date" value={r.acao?.prazo ?? ""}
                                onChange={(e) => patch(p.id, { acao: { ...(r.acao ?? acaoVazia), prazo: e.target.value } })} />
                            </div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <Select value={r.acao?.status ?? "aberta"}
                                onValueChange={(v) => patch(p.id, { acao: { ...(r.acao ?? acaoVazia), status: v } })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="aberta">Aberta</SelectItem>
                                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                                  <SelectItem value="concluida">Concluída</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Encerramento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">{PERGUNTA_ENCERRAMENTO}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={processoClaro === true ? "default" : "outline"} onClick={() => setProcessoClaro(true)}>Sim</Button>
            <Button
              type="button"
              size="sm"
              variant={processoClaro === false ? "default" : "outline"}
              className={processoClaro === false ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => setProcessoClaro(false)}
            >
              Não, ainda tenho dúvidas
            </Button>
          </div>
          <Textarea rows={2} placeholder="Observação (opcional)..." value={processoClaroObs} onChange={(e) => setProcessoClaroObs(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Observações gerais</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving || Object.values(itens).some((it) => it.enviando)}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
