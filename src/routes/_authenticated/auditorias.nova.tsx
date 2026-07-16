import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  component: NovaAuditoria,
});

function NovaAuditoria() {
  const navigate = useNavigate();
  const [areaId, setAreaId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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
    setPreviews((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))]);
  };

  const removeFoto = (idx: number) => {
    setFotos((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => {
      URL.revokeObjectURL(p[idx]);
      return p.filter((_, i) => i !== idx);
    });
  };

  const areasQ = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const auditoresQ = useQuery({
    queryKey: ["auditores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const usuariosQ = useQuery({

    queryKey: ["profiles-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, cargo, areas(nome)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });



  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const percentual = (total / 50) * 100;
  const cls = classificaPontuacao(percentual);

  const handleSave = async () => {
    if (!areaId || !auditorId) {
      toast.error("Selecione a área e o auditor");
      return;
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
    setSaving(true);
    const { data: inserted, error } = await supabase
      .from("auditorias")
      .insert({
        area_id: areaId,
        auditor_id: auditorId,
        data_auditoria: data,
        seiri: scores.seiri,
        seiton: scores.seiton,
        seiso: scores.seiso,
        seiketsu: scores.seiketsu,
        shitsuke: scores.shitsuke,
        pontuacao_total: total,
        percentual: Number(percentual.toFixed(2)),
        observacoes,
        status: "concluida",
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    const uploadedPaths: string[] = [];
    for (const file of fotos) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${inserted.id}/auditoria-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("audit-photos")
        .upload(path, file);
      if (upErr) {
        toast.error("Erro no upload de foto: " + upErr.message);
      } else {
        uploadedPaths.push(path);
      }
    }
    if (uploadedPaths.length > 0) {
      await supabase
        .from("auditorias")
        .update({ fotos: uploadedPaths })
        .eq("id", inserted.id);
    }

    // Ação corretiva automática para todo critério com nota < 6
    const ncRows = CRITERIOS_5S
      .filter((c) => scores[c.key] < 6)
      .map((c) => {
        const nota = scores[c.key];
        const comentario = comentarios[c.key].trim();
        return {
          auditoria_id: inserted.id,
          area_id: areaId,
          criterio: c.nome,
          descricao:
            comentario || `Não conformidade identificada em ${c.nome} (nota ${nota}).`,
          severidade: severidadePorNota(nota),
          status: "aberta",
          responsavel: ncResponsavel.trim() || null,
          responsavel_email: ncResponsavelEmail.trim() || null,
          prazo: ncPrazo || null,
        };
      });
    if (ncRows.length > 0) {
      const { error: ncErr } = await supabase.from("nao_conformidades").insert(ncRows);
      if (ncErr) toast.error("Erro ao gerar ações corretivas: " + ncErr.message);
    }

    setSaving(false);
    toast.success(
      ncRows.length > 0
        ? `Auditoria salva! ${ncRows.length} ação(ões) corretiva(s) gerada(s).`
        : "Auditoria salva com sucesso!",
    );
    navigate({ to: "/auditorias/$id", params: { id: inserted.id } });
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Área</Label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(areasQ.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome} {a.setor ? `· ${a.setor}` : ""}
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
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select
                value={ncResponsavel || undefined}
                onValueChange={(v) => {
                  const auditor = (auditoresQ.data ?? []).find((a: any) => a.nome === v);
                  setNcResponsavel(v);
                  if (auditor?.email) setNcResponsavelEmail(auditor.email);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(auditoresQ.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.nome}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">E-mail para envio</Label>
              <Input
                type="email"
                value={ncResponsavelEmail}
                onChange={(e) => setNcResponsavelEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={ncPrazo}
                onChange={(e) => setNcPrazo(e.target.value)}
              />
            </div>
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
              <span>Tirar foto</span>
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
              <span>Galeria</span>
              <input
                type="file"
                accept="image/*"
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
