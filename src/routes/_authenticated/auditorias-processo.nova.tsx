import { unitMatch, pickUnitQuestions, getActiveUnitId } from "@/lib/active-unit";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { draftStore } from "@/lib/audit-draft-store";
import { singleFlight, validateAnswers, uploadProgress } from "@/lib/audit-save-flow";
import { uploadAuditPhotos } from "@/lib/audit-photo-upload";
import { rollbackUploads } from "@/lib/upload-photos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Camera, X, AlertTriangle, Plus, Trash2, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias-processo/nova")({
  head: () => ({
    meta: [
      { title: "Nova Auditoria de Processo — AuditLog 5S" },
      { name: "description", content: "Preenchimento de auditoria de processo com checklist por pilar, evidências e plano de ação." },
      { property: "og:title", content: "Nova Auditoria de Processo — AuditLog 5S" },
      { property: "og:description", content: "Preenchimento de auditoria de processo com checklist por pilar, evidências e plano de ação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaAuditoriaProcesso,
});

const CATEGORIAS = ["Pessoas", "Ambiente", "Processo"] as const;

const PERGUNTA_ENCERRAMENTO =
  "Está clara a forma com que devem ser seguidos os processos bem como os impactos que o seu não-seguimento causam na nossa operação?";

type RespostaItem = {
  resposta: "SIM" | "NÃO" | "NA";
  observacao: string;
  oportunidadeMelhoria?: string;
  fotoPath: string;
  fotoPreview: string;
  salvando?: boolean;
  salvo?: boolean;
};

type AcaoItem = {
  oQue: string;
  como: string;
  responsavelId: string;
  prazo: string;
};

const respostaVazia: RespostaItem = {
  resposta: "SIM",
  observacao: "",
  fotoPath: "",
  fotoPreview: "",
};

const acaoVazia: AcaoItem = { oQue: "", como: "", responsavelId: "", prazo: "" };

function NovaAuditoriaProcesso() {
  const navigate = useNavigate();
  const [areaId, setAreaId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [colaboradorAuditado, setColaboradorAuditado] = useState("");
  const [turno, setTurno] = useState("");
  const [documentoReferencia, setDocumentoReferencia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [processoClaro, setProcessoClaro] = useState<boolean | null>(null);
  const [processoClaroObservacao, setProcessoClaroObservacao] = useState("");
  const [acoes, setAcoes] = useState<AcaoItem[]>([]);
  const [respostas, setRespostas] = useState<Record<string, RespostaItem>>({});
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const finished = useRef(false);
  const draftFlight = useRef(singleFlight<string | null>());
  const draftRef = useRef<string | null>(null);
  const answerQueue = useRef<Promise<unknown>>(Promise.resolve());
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ReturnType<typeof uploadProgress> | null>(null);
  const [saveError, setSaveError] = useState("");
  const [localKey, setLocalKey] = useState("");
  const [restored, setRestored] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState("");

  const addFotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFotos((f) => [...f, ...Array.from(files)]);
  };

  const removeFoto = (idx: number) => {
    setFotos((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  // ---- Rascunho + salvamento automático das respostas ----
  const ensureDraft = (): Promise<string | null> =>
    draftFlight.current(async () => {
      if (draftRef.current) return draftRef.current;
      if (!areaId || !auditorId) {
        toast.error("Selecione a área e o auditor antes de responder.");
        return null;
      }
      const unitId = areasQ.data?.find((area) => area.id === areaId)?.unit_id;
      if (!unitId) {
        toast.error("Não foi possível identificar a unidade da área.");
        return null;
      }
      const { data: d, error } = await supabase
        .from("auditorias_processo")
        .insert({
          area_id: areaId,
          unit_id: unitId,
          auditor_id: auditorId,
          data_auditoria: data,
          status: "rascunho",
        })
        .select("id")
        .single();
      if (error || !d) {
        toast.error("Erro ao iniciar auditoria: " + (error?.message ?? ""));
        return null;
      }
      draftRef.current = d.id;
      setDraftId(d.id);
      return d.id;
    });

  const patchResposta = (perguntaId: string, patch: Partial<RespostaItem>) =>
    setRespostas((s) => ({
      ...s,
      [perguntaId]: { ...respostaVazia, ...(s[perguntaId] ?? {}), ...patch },
    }));

  const persistRespostaNow = async (
    perguntaId: string,
    resposta: "SIM" | "NÃO" | "NA",
    extra?: { observacao?: string; fotoPath?: string; oportunidadeMelhoria?: string },
  ) => {
    const id = await ensureDraft();
    if (!id) return;
    patchResposta(perguntaId, { salvando: true });
    const { error } = await supabase.from("respostas_processo").upsert(
      {
        auditoria_processo_id: id,
        pergunta_id: perguntaId,
        resposta,
        observacao: extra?.observacao || null,
        foto_url: extra?.fotoPath || null,
        oportunidade_melhoria: extra?.oportunidadeMelhoria || null,
      },
      { onConflict: "auditoria_processo_id,pergunta_id" },
    );
    patchResposta(perguntaId, { salvando: false, salvo: !error });
    if (error) {
      const pergunta = perguntas.find((p) => p.id === perguntaId)?.pergunta ?? perguntaId;
      setSaveError(`Falha ao salvar pergunta "${pergunta}": ${error.message}`);
      toast.error(`Falha ao salvar pergunta "${pergunta}": ${error.message}`);
    }
  };

  const persistResposta = (...args: Parameters<typeof persistRespostaNow>) => {
    if (saveLock.current) return Promise.resolve();
    const next = answerQueue.current.catch(() => undefined).then(() => persistRespostaNow(...args));
    answerQueue.current = next;
    return next;
  };

  const responder = async (perguntaId: string, resposta: "SIM" | "NÃO" | "NA") => {
    patchResposta(perguntaId, { resposta });
    const atual = respostas[perguntaId];
    await persistResposta(perguntaId, resposta, {
      observacao: atual?.observacao,
      fotoPath: atual?.fotoPath,
      oportunidadeMelhoria: atual?.oportunidadeMelhoria,
    });
  };

  const uploadFotoPergunta = async (perguntaId: string, file: File | undefined) => {
    if (!file) return;
    const id = await ensureDraft();
    if (!id) return;
    const reader = new FileReader();
    reader.onload = () => patchResposta(perguntaId, { fotoPreview: reader.result as string });
    reader.readAsDataURL(file);
    let path: string;
    const uploadController = new AbortController();
    try {
      const paths = await uploadAuditPhotos([file], id, setProgress, uploadController.signal);
      if (!paths[0]) throw new Error("Foto não confirmada.");
      path = paths[0];
    } catch (error: any) {
      toast.error(error?.message ?? "O envio da evidência foi interrompido.");
      return;
    } finally {
      setProgress(null);
    }
    patchResposta(perguntaId, { fotoPath: path });
    const atual = respostas[perguntaId];
    await persistResposta(perguntaId, atual?.resposta ?? "SIM", {
      observacao: atual?.observacao,
      fotoPath: path,
      oportunidadeMelhoria: atual?.oportunidadeMelhoria,
    });
  };

  // ---- Consultas ----
  const areasQ = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .match(unitMatch())
        .eq("active", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const auditoresQ = useQuery({
    queryKey: ["auditores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditores").select("id, nome").order("nome");
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

  const areaNome = (areasQ.data ?? []).find((a: any) => a.id === areaId)?.nome ?? "";

  const perguntasQ = useQuery({
    queryKey: ["perguntas-processo", areaNome],
    enabled: !!areaNome,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perguntas_processo")
        .select("*")
        .eq("area_nome", areaNome)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return pickUnitQuestions(data ?? []);
    },
  });

  const perguntas = perguntasQ.data ?? [];

  // ---- Rascunho local (IndexedDB) — chave própria do módulo de processos ----
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      const key = `process:${auth.user.id}:${getActiveUnitId() ?? "default"}`;
      try {
        const draft = await draftStore(key, "read");
        if (cancelled) return;
        if (draft) {
          const { data: saved } = draft.draftId
            ? await supabase.from("auditorias_processo").select("status").eq("id", draft.draftId).maybeSingle()
            : { data: null };
          if (saved?.status === "concluida") await draftStore(key, "delete");
          else {
            setAreaId(draft.areaId);
            setAuditorId(draft.auditorId);
            setData(draft.data);
            setColaboradorAuditado(draft.colaboradorAuditado ?? "");
            setTurno(draft.turno ?? "");
            setDocumentoReferencia(draft.documentoReferencia ?? "");
            setObservacoes(draft.observacoes ?? "");
            setRespostas(draft.respostas ?? {});
            setProcessoClaro(draft.processoClaro ?? null);
            setProcessoClaroObservacao(draft.processoClaroObservacao ?? "");
            setAcoes(draft.acoes ?? []);
            setFotos(draft.fotos ?? []);
            setDraftId(saved ? draft.draftId : null);
            draftRef.current = saved ? draft.draftId : null;
            setDraftFeedback("Rascunho recuperado neste aparelho.");
          }
        }
        setLocalKey(key);
        setRestored(true);
      } catch {
        setDraftFeedback("Não foi possível recuperar o rascunho neste aparelho.");
        setRestored(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restored || !localKey || saving || finished.current || !areaId) return;
    const snapshot = {
      areaId, auditorId, data, turno, colaboradorAuditado, documentoReferencia, observacoes,
      respostas, processoClaro, processoClaroObservacao, acoes, fotos, draftId,
    };
    void draftStore(localKey, "write", snapshot)
      .then(() => setDraftFeedback("Rascunho salvo neste aparelho."))
      .catch(() =>
        setDraftFeedback("Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta."),
      );
  }, [restored, localKey, saving, areaId, auditorId, data, turno, colaboradorAuditado, documentoReferencia, observacoes, respostas, processoClaro, processoClaroObservacao, acoes, fotos, draftId]);

  useEffect(() => {
    const urls = fotos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [fotos]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveLock.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const offline = () => {
      if (saveLock.current) {
        controller.current?.abort();
        setSaveError("O envio foi interrompido antes da conclusão da auditoria. Rascunho preservado.");
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("offline", offline);
      controller.current?.abort();
    };
  }, []);

  // ---- Plano de ação ----
  const addAcao = () => setAcoes((a) => [...a, { ...acaoVazia }]);
  const removeAcao = (idx: number) => setAcoes((a) => a.filter((_, i) => i !== idx));
  const patchAcao = (idx: number, patch: Partial<AcaoItem>) =>
    setAcoes((a) => a.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const totalNaos = perguntas.filter((p: any) => respostas[p.id]?.resposta === "NÃO").length;

  // ---- Conclusão ----
  const handleSave = async () => {
    if (saveLock.current) return;
    try {
      validateAnswers(perguntas, respostas, ["SIM", "NÃO", "NA"]);
    } catch (e: any) {
      toast.error(e.message);
      return;
    }
    if (!areaId || !auditorId) {
      toast.error("Selecione a área e o auditor");
      return;
    }
    if (!turno) {
      toast.error("Selecione o turno");
      return;
    }
    const naoRespondidas = perguntas.filter((p: any) => !respostas[p.id]);
    if (naoRespondidas.length > 0) {
      toast.error(`Responda todas as perguntas (${naoRespondidas.length} pendente(s)).`);
      return;
    }
    if (processoClaro === null) {
      toast.error("Responda a pergunta de encerramento antes de concluir.");
      return;
    }
    const acaoIncompleta = acoes.find(
      (a) => !a.oQue.trim() && (a.como.trim() || a.responsavelId || a.prazo),
    );
    if (acaoIncompleta) {
      toast.error('Preencha o campo "O que" em todas as linhas do plano de ação ou remova a linha.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    controller.current = new AbortController();
    let uploadedPaths: string[] = [];
    let committed = false;
    try {
      await answerQueue.current;
      const auditoriaId = await ensureDraft();
      if (!auditoriaId) throw new Error("Não foi possível iniciar o rascunho.");
      uploadedPaths = await uploadAuditPhotos(fotos, auditoriaId, setProgress, controller.current.signal);

      const { data: concluidaId, error: completionError } = await supabase.rpc("complete_audit_processo", {
        p_id: auditoriaId,
        p_audit: {
          area_id: areaId,
          auditor_id: auditorId,
          colaborador_auditado: colaboradorAuditado || null,
          documento_referencia: documentoReferencia || null,
          data_auditoria: data,
          turno,
          processo_claro: processoClaro,
          processo_claro_observacao: processoClaroObservacao || null,
          observacoes: observacoes || null,
          fotos: uploadedPaths,
        },
        p_answers: perguntas
          .filter((p: any) => respostas[p.id])
          .map((p: any) => ({
            pergunta_id: p.id,
            resposta: respostas[p.id].resposta,
            observacao: respostas[p.id].observacao || null,
            foto_url: respostas[p.id].fotoPath || null,
            oportunidade_melhoria: respostas[p.id].oportunidadeMelhoria || null,
          })),
        p_acoes: acoes
          .filter((a) => a.oQue.trim())
          .map((a) => ({
            o_que: a.oQue.trim(),
            como: a.como.trim() || null,
            responsavel_id: a.responsavelId || null,
            prazo: a.prazo || null,
          })),
      });
      if (completionError) {
        // Resposta perdida é ambígua: releia o status antes de remover evidências possivelmente gravadas.
        const { data: state, error: stateError } = await supabase
          .from("auditorias_processo")
          .select("status")
          .eq("id", auditoriaId)
          .single();
        if (stateError) {
          uploadedPaths = []; // mantém evidências até confirmar o resultado; nunca quebra uma auditoria gravada
          throw new Error(
            "Não foi possível confirmar a conclusão. O rascunho foi preservado; verifique a auditoria antes de tentar novamente.",
          );
        }
        if (state?.status !== "concluida") throw completionError;
      }
      committed = true;
      finished.current = true;
      if (localKey) await draftStore(localKey, "delete").catch(() => undefined);
      toast.success("Auditoria de processo salva com sucesso!");
      navigate({ to: "/auditorias-processo/$id", params: { id: (concluidaId as string) ?? auditoriaId } });
    } catch (error: any) {
      if (!committed && uploadedPaths.length && draftRef.current)
        await rollbackUploads(uploadedPaths, "auditoria-processo-fotos-gerais", draftRef.current, error);
      const message = "O envio foi interrompido antes da conclusão da auditoria. " + (error?.message ?? "Tente novamente.");
      setSaveError(message);
      toast.error(message);
    } finally {
      saveLock.current = false;
      setSaving(false);
      setProgress(null);
      controller.current = null;
    }
  };

  const noAreas = !areasQ.isLoading && (areasQ.data?.length ?? 0) === 0;
  const noAuditores = !auditoresQ.isLoading && (auditoresQ.data?.length ?? 0) === 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/auditorias-processo">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Nova Auditoria de Processo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Responda cada pergunta com Sim ou Não. As notas por pilar são calculadas automaticamente ao concluir.
        </p>
      </div>

      {(noAreas || noAuditores) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-amber-900">Cadastro necessário:</p>
            <ul className="mt-1 text-amber-800 space-y-1">
              {noAreas && (
                <li>
                  · <Link to="/areas" className="underline">Cadastrar áreas</Link>
                </li>
              )}
              {noAuditores && (
                <li>
                  · <Link to="/auditores" className="underline">Cadastrar auditores</Link>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {draftFeedback && <p role="status" className="text-sm text-muted-foreground">{draftFeedback}</p>}
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

      <fieldset disabled={saving} className="space-y-6 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados gerais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Área</Label>
              <Select
                value={areaId}
                disabled={!!draftId}
                onValueChange={(v) => {
                  setAreaId(v);
                  setRespostas({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(areasQ.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auditor</Label>
              <Select value={auditorId} onValueChange={setAuditorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(auditoresQ.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Input
                value={colaboradorAuditado}
                onChange={(e) => setColaboradorAuditado(e.target.value)}
                placeholder="Nome da pessoa observada"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Documento de referência (opcional)</Label>
              <Input
                value={documentoReferencia}
                onChange={(e) => setDocumentoReferencia(e.target.value)}
                placeholder="Ex.: POP-CTT-001, procedimento, instrução de trabalho..."
              />
            </div>
          </CardContent>
        </Card>

        {areaId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist da área {areaNome}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {perguntasQ.isLoading && (
                <p className="text-sm text-muted-foreground">Carregando perguntas...</p>
              )}
              {!perguntasQ.isLoading && perguntas.length === 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <p>
                    Esta área não possui perguntas de processo cadastradas. A auditoria será
                    concluída utilizando apenas as evidências e ações registradas.
                  </p>
                  <Link to="/perguntas-processo" className="underline">
                    Cadastrar perguntas
                  </Link>
                </div>
              )}
              {CATEGORIAS.map((cat) => {
                const lista = perguntas.filter((p: any) => p.categoria === cat);
                if (lista.length === 0) return null;
                return (
                  <div key={cat} className="space-y-3">
                    <h3 className="font-semibold text-primary border-b pb-1">{cat}</h3>
                    {lista.map((p: any, i: number) => {
                      const r = respostas[p.id];
                      return (
                        <div key={p.id} className="rounded-md border p-3 space-y-2">
                          <p className="text-sm font-medium">
                            {i + 1}. {p.pergunta}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(["SIM", "NÃO", "NA"] as const).map((op) => (
                              <Button
                                key={op}
                                type="button"
                                size="sm"
                                variant={r?.resposta === op ? "default" : "outline"}
                                className={
                                  r?.resposta === op && op === "NÃO"
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : r?.resposta === op && op === "NA"
                                      ? "bg-muted-foreground/30 text-foreground hover:bg-muted-foreground/40"
                                      : ""
                                }
                                onClick={() => responder(p.id, op)}
                              >
                                {op === "SIM" ? "Sim" : op === "NÃO" ? "Não" : "N/A"}
                              </Button>
                            ))}
                            <label className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                              <Camera className="h-4 w-4" /> Anexar foto
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  uploadFotoPergunta(p.id, e.target.files?.[0]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {r?.salvando && (
                              <span className="text-[11px] text-muted-foreground">salvando...</span>
                            )}
                            {!r?.salvando && r?.salvo && (
                              <span className="text-[11px] text-emerald-600">salvo automaticamente</span>
                            )}
                          </div>
                          {r?.fotoPreview && (
                            <img
                              src={r.fotoPreview}
                              alt="Evidência"
                              className="h-14 w-14 object-cover rounded border"
                            />
                          )}
                          <Textarea
                            rows={1}
                            placeholder="Observação (opcional)..."
                            value={r?.observacao ?? ""}
                            onChange={(e) => patchResposta(p.id, { observacao: e.target.value })}
                            onBlur={() => {
                              if (r?.resposta)
                                persistResposta(p.id, r.resposta, {
                                  observacao: r.observacao,
                                  fotoPath: r.fotoPath,
                                  oportunidadeMelhoria: r.oportunidadeMelhoria,
                                });
                            }}
                          />
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 mt-2 text-accent shrink-0" />
                            <Textarea
                              rows={1}
                              placeholder="Oportunidade de melhoria (opcional)..."
                              value={r?.oportunidadeMelhoria ?? ""}
                              onChange={(e) => patchResposta(p.id, { oportunidadeMelhoria: e.target.value })}
                              onBlur={() => {
                                if (r?.resposta)
                                  persistResposta(p.id, r.resposta, {
                                    observacao: r.observacao,
                                    fotoPath: r.fotoPath,
                                    oportunidadeMelhoria: r.oportunidadeMelhoria,
                                  });
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {areaId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Encerramento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{PERGUNTA_ENCERRAMENTO}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant={processoClaro === true ? "default" : "outline"}
                  onClick={() => setProcessoClaro(true)}
                >
                  Sim
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={processoClaro === false ? "default" : "outline"}
                  className={
                    processoClaro === false
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : ""
                  }
                  onClick={() => setProcessoClaro(false)}
                >
                  Não, ainda tenho dúvidas
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Observação (opcional)..."
                value={processoClaroObservacao}
                onChange={(e) => setProcessoClaroObservacao(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {areaId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plano de ação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalNaos > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Você marcou {totalNaos} pergunta(s) como NÃO. Preencha o plano de ação abaixo, se aplicável.
                  </p>
                </div>
              )}
              {acoes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ação adicionada. Use o botão abaixo para incluir ações, se necessário.
                </p>
              )}
              {acoes.map((a, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-primary">Ação {idx + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAcao(idx)}
                      aria-label={`Remover ação ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">O que *</Label>
                    <Textarea
                      rows={2}
                      placeholder="Descreva a ação que será executada..."
                      value={a.oQue}
                      onChange={(e) => patchAcao(idx, { oQue: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Como (opcional)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Como a ação será executada..."
                      value={a.como}
                      onChange={(e) => patchAcao(idx, { como: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <UserPickerField
                      label="Quem"
                      value={a.responsavelId}
                      onChange={(v) => patchAcao(idx, { responsavelId: v })}
                      users={usuariosQ.data ?? []}
                    />
                    <div>
                      <Label className="text-xs">Quando (opcional)</Label>
                      <Input
                        type="date"
                        value={a.prazo}
                        onChange={(e) => patchAcao(idx, { prazo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAcao}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar ação
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações gerais sobre a auditoria..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" /> Fotos da auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md aspect-square cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span>Tirar Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    addFotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md aspect-square cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span>Selecionar Arquivo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,.jpg,.jpeg,.jfif,.png,.webp,.heic"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {previews.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFoto(idx)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    aria-label="Remover foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {fotos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {fotos.length} foto(s) anexada(s). Serão enviadas ao salvar a auditoria.
              </p>
            )}
          </CardContent>
        </Card>
      </fieldset>

      {(saving || progress) && (
        <div role="status" aria-live="polite" className="space-y-2">
          <p>
            {progress && progress.completed < progress.total
              ? `Enviando foto ${progress.completed + 1} de ${progress.total}`
              : "Gravando respostas e concluindo auditoria…"}
          </p>
          {progress && (
            <>
              <progress className="w-full" value={progress.percent} max={100} aria-label="Progresso do envio" />
              <p>
                {progress.percent}% ·{" "}
                {progress.secondsRemaining === null
                  ? "Estimando tempo…"
                  : `Tempo estimado restante: ${progress.secondsRemaining} s`}
              </p>
            </>
          )}
        </div>
      )}

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
              Checklist
            </p>
            <p className="text-3xl font-bold">
              {Object.keys(respostas).length}/{perguntas.length}{" "}
              <span className="text-accent">respondidas</span>
            </p>
            <p className="text-sm mt-1">As notas por pilar são calculadas ao concluir.</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar auditoria"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function UserPickerField({
  label,
  value,
  onChange,
  users,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  users: Array<{ id: string; nome: string | null; cargo?: string | null; areas?: { nome: string | null } | null }>;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Sem responsável —</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <div className="flex flex-col text-left">
                <span className="font-medium">{u.nome ?? "Sem nome"}</span>
                <span className="text-[11px] text-muted-foreground">
                  {[u.cargo, u.areas?.nome].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
