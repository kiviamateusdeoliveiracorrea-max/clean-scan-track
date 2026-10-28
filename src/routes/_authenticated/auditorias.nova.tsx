import { calcularScore } from "@/lib/audit-score";
import { unitMatch, pickUnitQuestions } from "@/lib/active-unit";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getActiveUnitId } from "@/lib/active-unit";
import { draftStore } from "@/lib/audit-draft-store";
import { singleFlight, validateAnswers, uploadProgress } from "@/lib/audit-save-flow";
import { uploadAuditPhotos } from "@/lib/audit-photo-upload";
import { supabase } from "@/integrations/supabase/client";
import { rollbackUploads } from "@/lib/upload-photos";
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
import { Slider } from "@/components/ui/slider";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, Camera, X, AlertTriangle, Info } from "lucide-react";
import {
  CRITERIOS_5S,
  classificaPontuacao,
  ESCALA_PONTUACAO,
  severidadePorNota,
  type Criterio5SKey,
} from "@/lib/audit-constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias/nova")({
  head: () => ({ meta: [{ title: "Nova Auditoria 5S | AuditLog" }, { name: "description", content: "Registre uma auditoria 5S com respostas e evidências." }, { property: "og:title", content: "Nova Auditoria 5S | AuditLog" }, { property: "og:description", content: "Registro de auditorias e evidências 5S." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NovaAuditoria,
});

const AREAS_PADRAO = [
  "Recebimento",
  "Estocagem",
  "Ativação",
  "Almoxarifado",
  "CEM",
  "Expedição",
  "Usinagem",
  "Oleamento",
  "Blocado",
  "CTT",
];

const CATEGORIAS = ["Pessoas", "Ambiente", "Processo"] as const;

function NovaAuditoria() {
  const navigate = useNavigate();
  const [areaId, setAreaId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const draftFlight = useRef(singleFlight<string | null>());
  const draftRef = useRef<string | null>(null);
  const answerQueue = useRef<Promise<unknown>>(Promise.resolve());
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ReturnType<typeof uploadProgress> | null>(null);
  const [saveError, setSaveError] = useState("");
  const [localKey, setLocalKey] = useState("");
  const [restored, setRestored] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  type RespostaItem = {
    resposta: "SIM" | "NÃO";
    observacao: string;
    descricao: string;
    fotoPath: string;
    fotoPreview: string;
    responsavelId: string;
    prazo: string;
    planoAcao: string;
    statusAcao: "aberta" | "em_andamento" | "concluida";
    salvando?: boolean;
    salvo?: boolean;
  };
  const [draftId, setDraftId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, RespostaItem>>({});


  const [scores, setScores] = useState<Record<Criterio5SKey, number>>({
    seiri: 7,
    seiton: 7,
    seiso: 7,
    seiketsu: 7,
    shitsuke: 7,
  });
  const [comentarios, setComentarios] = useState<Record<Criterio5SKey, string>>({
    seiri: "",
    seiton: "",
    seiso: "",
    seiketsu: "",
    shitsuke: "",
  });
  const [ncResponsavelAcaoId, setNcResponsavelAcaoId] = useState<string>("");
  const [ncAprovadorId, setNcAprovadorId] = useState<string>("");
  const [ncPrazo, setNcPrazo] = useState("");

  const addFotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setFotos((f) => [...f, ...arr]);

  };

  const removeFoto = (idx: number) => {
    setFotos((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  // ---- Rascunho + salvamento automático das respostas ----
  const ensureDraft = (): Promise<string | null> => draftFlight.current(async () => {
    if (draftRef.current) return draftRef.current;
    if (!areaId || !auditorId) {
      toast.error("Selecione a área e o auditor antes de responder.");
      return null;
    }
    const { data: d, error } = await supabase.from("auditorias").insert({
      area_id: areaId, auditor_id: auditorId, data_auditoria: data, status: "rascunho",
    }).select("id").single();
    if (error || !d) {
      toast.error("Erro ao iniciar auditoria: " + (error?.message ?? ""));
      return null;
    }
    draftRef.current = d.id;
    setDraftId(d.id);
    return d.id;
  });

  const respostaVazia: RespostaItem = {
    resposta: "SIM",
    observacao: "",
    descricao: "",
    fotoPath: "",
    fotoPreview: "",
    responsavelId: "",
    prazo: "",
    planoAcao: "",
    statusAcao: "aberta",
  };

  const patchResposta = (perguntaId: string, patch: Partial<RespostaItem>) =>
    setRespostas((s) => ({
      ...s,
      [perguntaId]: { ...respostaVazia, ...(s[perguntaId] ?? {}), ...patch },
    }));


  const persistRespostaNow = async (
    perguntaId: string,
    resposta: "SIM" | "NÃO",
    extra?: { observacao?: string; fotoPath?: string },
  ) => {
    const id = await ensureDraft();
    if (!id) return;
    patchResposta(perguntaId, { salvando: true });
    const { error } = await supabase.from("respostas_auditoria").upsert(
      {
        auditoria_id: id,
        pergunta_id: perguntaId,
        resposta,
        observacao: extra?.observacao || null,
        foto_url: extra?.fotoPath || null,
      },
      { onConflict: "auditoria_id,pergunta_id" },
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

  const responder = async (perguntaId: string, resposta: "SIM" | "NÃO") => {
    patchResposta(perguntaId, { resposta });
    const atual = respostas[perguntaId];
    await persistResposta(perguntaId, resposta, {
      observacao: resposta === "NÃO" ? atual?.descricao || atual?.observacao : "",
      fotoPath: resposta === "NÃO" ? atual?.fotoPath : "",
    });
  };

  const uploadNcFoto = async (perguntaId: string, file: File | undefined) => {
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
    } finally { setProgress(null); }
    patchResposta(perguntaId, { fotoPath: path });
    const atual = respostas[perguntaId];
    await persistResposta(perguntaId, "NÃO", {
      observacao: atual?.descricao,
      fotoPath: path,
    });
  };



  const areasQ = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("*").match(unitMatch()).eq("active", true).order("nome");
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

  const areasDisponiveis = (areasQ.data ?? [])
    .filter((a: any) => AREAS_PADRAO.includes(a.nome))
    .sort(
      (a: any, b: any) =>
        AREAS_PADRAO.indexOf(a.nome) - AREAS_PADRAO.indexOf(b.nome),
    );
  const areaNome =
    (areasQ.data ?? []).find((a: any) => a.id === areaId)?.nome ?? "";

  const perguntasQ = useQuery({
    queryKey: ["perguntas-auditoria", areaNome],
    enabled: !!areaNome,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perguntas_auditoria")
        .select("*")
        .eq("area_nome", areaNome)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return pickUnitQuestions(data ?? []);
    },
  });

  const perguntas = perguntasQ.data ?? [];

  // ---- Notas: pontos obtidos / pontos possíveis (peso), NA excluído ----
  const scoreDe = (lista: any[]) =>
    calcularScore(
      lista
        .filter((p: any) => respostas[p.id])
        .map((p: any) => ({ resposta: respostas[p.id].resposta as any, peso: p.peso })),
    ).percentual;
  const notaCategoria = (cat: string) =>
    scoreDe(perguntas.filter((p: any) => p.categoria === cat));
  const notaPessoas = notaCategoria("Pessoas");
  const notaAmbiente = notaCategoria("Ambiente");
  const notaProcesso = notaCategoria("Processo");
  const notaFinal = scoreDe(perguntas);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const percentual = notaFinal ?? (total / 50) * 100;
  const cls = classificaPontuacao(percentual);


  useEffect(() => {
    const urls = fotos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [fotos]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      const key = `${auth.user.id}:${getActiveUnitId() ?? "default"}`;
      try {
        const draft = await draftStore(key, "read");
        if (cancelled) return;
        if (draft) {
          const { data: saved } = draft.draftId ? await supabase.from("auditorias").select("status").eq("id", draft.draftId).maybeSingle() : { data: null };
          if (saved?.status === "concluida") await draftStore(key, "delete");
          else {
            setAreaId(draft.areaId); setAuditorId(draft.auditorId); setData(draft.data);
            setObservacoes(draft.observacoes); setRespostas(draft.respostas); setScores(draft.scores);
            setComentarios(draft.comentarios); setFotos(draft.fotos ?? []);
            setDraftId(saved ? draft.draftId : null); draftRef.current = saved ? draft.draftId : null;
            setNcResponsavelAcaoId(draft.ncResponsavelAcaoId ?? ""); setNcAprovadorId(draft.ncAprovadorId ?? ""); setNcPrazo(draft.ncPrazo ?? "");
            setDraftFeedback("Rascunho recuperado neste aparelho.");
          }
        }
        setLocalKey(key); setRestored(true);
      } catch { setDraftFeedback("Não foi possível recuperar o rascunho neste aparelho."); setRestored(true); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!restored || !localKey || saving || !areaId) return;
    const snapshot = { areaId, auditorId, data, observacoes, respostas, scores, comentarios, fotos, draftId,
      ncResponsavelAcaoId, ncAprovadorId, ncPrazo };
    void draftStore(localKey, "write", snapshot).then(() => setDraftFeedback("Rascunho salvo neste aparelho.")).catch(() => setDraftFeedback("Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta."));
  }, [restored, localKey, saving, areaId, auditorId, data, observacoes, respostas, scores, comentarios, fotos, draftId, ncResponsavelAcaoId, ncAprovadorId, ncPrazo]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveLock.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const offline = () => { if (saveLock.current) { controller.current?.abort(); setSaveError("O envio foi interrompido antes da conclusão da auditoria. Rascunho preservado."); } };
    window.addEventListener("beforeunload", beforeUnload); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("offline", offline); controller.current?.abort(); };
  }, []);

  const handleSave = async () => {
    if (saveLock.current) return;
    try { validateAnswers(perguntas, respostas); } catch (e: any) { toast.error(e.message); return; }
    if (!areaId || !auditorId) {
      toast.error("Selecione a área e o auditor");
      return;
    }
    const naoRespondidas = perguntas.filter((p: any) => !respostas[p.id]);
    if (naoRespondidas.length > 0) {
      toast.error(`Responda todas as perguntas (${naoRespondidas.length} pendente(s)).`);
      return;
    }
    const naos = perguntas.filter((p: any) => respostas[p.id]?.resposta === "NÃO");
    for (const p of naos) {
      const r = respostas[p.id];
      if (!r.descricao.trim()) {
        toast.error("Descrição da não conformidade obrigatória: " + p.pergunta);
        return;
      }
      if (!r.fotoPath) {
        toast.error("Evidência fotográfica obrigatória: " + p.pergunta);
        return;
      }
      if (!r.responsavelId) {
        toast.error("Responsável pela ação obrigatório: " + p.pergunta);
        return;
      }
      if (!r.prazo) {
        toast.error("Prazo obrigatório: " + p.pergunta);
        return;
      }
    }
    const semComentario = CRITERIOS_5S.filter(
      (c) => scores[c.key] < 8 && !comentarios[c.key].trim(),
    );
    if (semComentario.length > 0) {
      toast.error(
        `Comentário obrigatório para: ${semComentario.map((c) => c.nome).join(", ")} (nota < 8)`,
      );
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
    const auditFields = {
        area_id: areaId, auditor_id: auditorId, data_auditoria: data,
        ...scores, pontuacao_total: total, percentual: Number(percentual.toFixed(2)),
        nota_pessoas: notaPessoas, nota_ambiente: notaAmbiente, nota_processo: notaProcesso,
        observacoes, fotos: uploadedPaths,
    };

    // garante que todas as respostas estão gravadas
    const respostaRows = perguntas
      .filter((p: any) => respostas[p.id])
      .map((p: any) => ({
        auditoria_id: auditoriaId,
        pergunta_id: p.id,
        resposta: respostas[p.id].resposta,
        observacao:
          (respostas[p.id].resposta === "NÃO"
            ? respostas[p.id].descricao
            : respostas[p.id].observacao) || null,
        foto_url: respostas[p.id].fotoPath || null,
      }));
    const users = usuariosQ.data ?? [];
    const respUser = users.find((u: any) => u.id === ncResponsavelAcaoId) as any;
    const { data: userData } = await supabase.auth.getUser();
    const criadorId = userData.user?.id ?? null;

    // NC + Plano de Ação para cada resposta "NÃO"
    const ncPerguntas = naos.map((p: any) => {
      const r = respostas[p.id];
      const alvo = users.find((u: any) => u.id === r.responsavelId) as any;
      return {
        auditoria_id: auditoriaId,
        area_id: areaId,
        criterio: `${p.categoria} · ${p.pergunta}`,
        descricao: r.descricao.trim(),
        severidade: "media",
        status: r.statusAcao,
        plano_acao: r.planoAcao.trim() || null,
        responsavel: alvo?.nome ?? null,
        responsavel_nc_id: criadorId,
        responsavel_acao_id: r.responsavelId || null,
        aprovador_id: ncAprovadorId || null,
        prazo: r.prazo,
        foto_urls: r.fotoPath ? [r.fotoPath] : [],
      };
    });

    // Ação corretiva automática para todo critério 5S com nota < 6
    const ncRows5S = CRITERIOS_5S
      .filter((c) => scores[c.key] < 6)
      .map((c) => {
        const nota = scores[c.key];
        const comentario = comentarios[c.key].trim();
        return {
          auditoria_id: auditoriaId,
          area_id: areaId,
          criterio: c.nome,
          descricao:
            comentario || `Não conformidade identificada em ${c.nome} (nota ${nota}).`,
          severidade: severidadePorNota(nota),
          status: "aberta",
          responsavel: respUser?.nome ?? null,
          responsavel_nc_id: criadorId,
          responsavel_acao_id: ncResponsavelAcaoId || null,
          aprovador_id: ncAprovadorId || null,
          prazo: ncPrazo || null,
        };
      });

    const ncRows = [...ncPerguntas, ...ncRows5S];
    const { error: completionError } = await supabase.rpc("complete_audit", {
      p_id: auditoriaId, p_audit: auditFields, p_answers: respostaRows, p_ncs: ncRows,
    });
    if (completionError) {
      // A lost response is ambiguous: read the status before removing possibly committed evidence.
      const { data: state, error: stateError } = await supabase.from("auditorias").select("status").eq("id", auditoriaId).single();
      if (stateError) {
        uploadedPaths = []; // keep evidence until outcome can be confirmed; never break a committed audit
        throw new Error("Não foi possível confirmar a conclusão. O rascunho foi preservado; verifique a auditoria antes de tentar novamente.");
      }
      if (state?.status !== "concluida") throw completionError;
    }
    committed = true;
    if (localKey) await draftStore(localKey, "delete").catch(() => undefined);
    setSaving(false);
    toast.success(
      ncRows.length > 0
        ? `Auditoria salva! ${ncRows.length} ação(ões) corretiva(s) gerada(s).`
        : "Auditoria salva com sucesso!",
    );
    navigate({ to: "/auditorias/$id", params: { id: auditoriaId } });
    } catch (error: any) {
      if (!committed && uploadedPaths.length && draftRef.current) await rollbackUploads(uploadedPaths, "auditoria-fotos-gerais", draftRef.current, error);
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
          <Link to="/auditorias">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Nova Auditoria 5S</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avalie cada critério de 0 a 10.
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
                {areasDisponiveis.map((a: any) => (
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
        </CardContent>
      </Card>

      {areaId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Checklist da área {areaNome}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {perguntasQ.isLoading && (
              <p className="text-sm text-muted-foreground">Carregando perguntas...</p>
            )}
            {!perguntasQ.isLoading && perguntas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma pergunta cadastrada para esta área.{" "}
                <Link to="/perguntas" className="underline">
                  Cadastrar perguntas
                </Link>
              </p>
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
                          {i + 1}. {p.pergunta}{" "}
                          <span className="text-xs text-muted-foreground">
                            (peso {p.peso})
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {(["SIM", "NÃO"] as const).map((op) => (
                            <Button
                              key={op}
                              type="button"
                              size="sm"
                              variant={r?.resposta === op ? "default" : "outline"}
                              className={
                                r?.resposta === op && op === "NÃO"
                                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  : ""
                              }
                              onClick={() => responder(p.id, op)}
                            >
                              {op === "SIM" ? "Sim" : "Não"}
                            </Button>
                          ))}
                          {r?.salvando && (
                            <span className="text-[11px] text-muted-foreground">
                              salvando...
                            </span>
                          )}
                          {!r?.salvando && r?.salvo && (
                            <span className="text-[11px] text-emerald-600">
                              salvo automaticamente
                            </span>
                          )}
                        </div>
                        {r?.resposta === "NÃO" && (
                          <div className="rounded-md border border-red-300 bg-red-50/60 p-3 space-y-3">
                            <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Não conformidade — todos os campos são obrigatórios
                            </p>
                            <div>
                              <Label className="text-xs">Descrição da não conformidade *</Label>
                              <Textarea
                                rows={2}
                                placeholder="Descreva o desvio observado..."
                                value={r.descricao}
                                onChange={(e) =>
                                  patchResposta(p.id, { descricao: e.target.value })
                                }
                                onBlur={() =>
                                  persistResposta(p.id, "NÃO", {
                                    observacao: r.descricao,
                                    fotoPath: r.fotoPath,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Evidência fotográfica *</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <label className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                                  <Camera className="h-4 w-4" /> Tirar foto
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                      uploadNcFoto(p.id, e.target.files?.[0]);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                                <label className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                                  <Camera className="h-4 w-4" /> Selecionar arquivo
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                      uploadNcFoto(p.id, e.target.files?.[0]);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                                {r.fotoPreview && (
                                  <img
                                    src={r.fotoPreview}
                                    alt="Evidência"
                                    className="h-14 w-14 object-cover rounded border"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <UserPickerField
                                label="Responsável pela ação *"
                                value={r.responsavelId}
                                onChange={(v) => patchResposta(p.id, { responsavelId: v })}
                                users={usuariosQ.data ?? []}
                              />
                              <div>
                                <Label className="text-xs">Prazo *</Label>
                                <Input
                                  type="date"
                                  value={r.prazo}
                                  onChange={(e) => patchResposta(p.id, { prazo: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3 space-y-3">
                              <p className="text-xs font-semibold text-primary">
                                Plano de Ação
                              </p>
                              <div>
                                <Label className="text-xs">O que será feito</Label>
                                <Textarea
                                  rows={2}
                                  placeholder="Descreva a ação que será executada..."
                                  value={r.planoAcao}
                                  onChange={(e) =>
                                    patchResposta(p.id, { planoAcao: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Status</Label>
                                <Select
                                  value={r.statusAcao}
                                  onValueChange={(v) =>
                                    patchResposta(p.id, {
                                      statusAcao: v as RespostaItem["statusAcao"],
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="aberta">Aberto</SelectItem>
                                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                                    <SelectItem value="concluida">Concluído</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Responsável e prazo do plano seguem os campos acima.
                              </p>
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
      )}



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avaliação dos 5 Sensos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {CRITERIOS_5S.map((c) => {
            const val = scores[c.key];
            const needsComment = val < 8;
            const autoNC = val < 6;
            const critica = val < 4;
            const sev = severidadePorNota(val);
            const scoreBoxClass = critica
              ? "bg-red-600 text-white"
              : autoNC
                ? "bg-amber-500 text-white"
                : needsComment
                  ? "bg-amber-300 text-amber-950"
                  : "bg-primary text-primary-foreground";
            return (
              <div key={c.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary flex items-center gap-1.5">
                      {c.nome}{" "}
                      <span className="font-normal text-muted-foreground">· {c.titulo}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary"
                            aria-label="Ver critérios de pontuação"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-xs space-y-2">
                          <p className="font-semibold text-sm">Critérios de pontuação</p>
                          {ESCALA_PONTUACAO.map((e) => (
                            <div key={e.faixa} className="flex gap-2">
                              <span className="font-bold w-14 shrink-0">{e.faixa}</span>
                              <span>
                                <span className="font-medium">{e.titulo}.</span>{" "}
                                <span className="text-muted-foreground">{e.descricao}</span>
                              </span>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  <div
                    className={`grid place-items-center h-10 w-14 rounded-md font-bold text-lg shrink-0 ${scoreBoxClass}`}
                  >
                    {val}
                  </div>
                </div>
                <Slider
                  value={[val]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setScores((s) => ({ ...s, [c.key]: v[0] }))}
                />
                {needsComment && (
                  <div
                    className={`rounded-md border p-3 space-y-2 ${
                      critica
                        ? "border-red-400 bg-red-50"
                        : autoNC
                          ? "border-amber-400 bg-amber-50"
                          : "border-dashed bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <AlertTriangle
                        className={`h-4 w-4 ${critica ? "text-red-600" : "text-amber-600"}`}
                      />
                      {autoNC ? (
                        <span className="font-medium">
                          Ação corretiva será aberta automaticamente
                        </span>
                      ) : (
                        <span className="font-medium">Comentário obrigatório (nota &lt; 8)</span>
                      )}
                      {autoNC && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            critica
                              ? "bg-red-600 text-white"
                              : "bg-amber-600 text-white"
                          }`}
                        >
                          Severidade: {sev}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={comentarios[c.key]}
                      onChange={(e) =>
                        setComentarios((n) => ({ ...n, [c.key]: e.target.value }))
                      }
                      placeholder={
                        autoNC
                          ? `Descreva a não conformidade em ${c.nome}...`
                          : `Descreva o desvio observado em ${c.nome}...`
                      }
                      rows={2}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {CRITERIOS_5S.some((c) => scores[c.key] < 6) && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Tratativa das não conformidades
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <UserPickerField
              label="Responsável pela Ação"
              value={ncResponsavelAcaoId}
              onChange={setNcResponsavelAcaoId}
              users={usuariosQ.data ?? []}
            />
            <UserPickerField
              label="Aprovador (Gestor/Admin)"
              value={ncAprovadorId}
              onChange={setNcAprovadorId}
              users={usuariosQ.data ?? []}
            />
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={ncPrazo}
                onChange={(e) => setNcPrazo(e.target.value)}
              />
            </div>
            <p className="sm:col-span-3 text-xs text-muted-foreground">
              Qualquer usuário ativo pode ser designado — Administrador, Gestor, Auditor ou Consulta.
            </p>
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



      {perguntas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notas do checklist</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: "Pessoas", v: notaPessoas },
              { l: "Ambiente", v: notaAmbiente },
              { l: "Processo", v: notaProcesso },
              { l: "Nota Final", v: notaFinal },
            ].map((n) => (
              <div key={n.l} className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {n.l}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {n.v === null ? "—" : `${n.v.toFixed(0)}%`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      </fieldset>
      {(saving || progress) && <div role="status" aria-live="polite" className="space-y-2">
        <p>{progress && progress.completed < progress.total ? `Enviando foto ${progress.completed + 1} de ${progress.total}` : "Gravando respostas e concluindo auditoria…"}</p>
        {progress && <><progress className="w-full" value={progress.percent} max={100} aria-label="Progresso do envio" /><p>{progress.percent}% · {progress.secondsRemaining === null ? "Estimando tempo…" : `Tempo estimado restante: ${progress.secondsRemaining} s`}</p></>}
      </div>}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
              Pontuação total
            </p>
            <p className="text-3xl font-bold">
              {total}/50 <span className="text-accent">· {percentual.toFixed(0)}%</span>
            </p>
            <p className="text-sm mt-1">{cls.label}</p>
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
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
      >
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

