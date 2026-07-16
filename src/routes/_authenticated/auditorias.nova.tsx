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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Camera, X, AlertTriangle } from "lucide-react";
import { CRITERIOS_5S, classificaPontuacao, type Criterio5SKey } from "@/lib/audit-constants";
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
  type NcEntry = { marked: boolean; descricao: string };
  const emptyNc: NcEntry = { marked: false, descricao: "" };
  const [ncs, setNcs] = useState<Record<Criterio5SKey, NcEntry>>({
    seiri: { ...emptyNc },
    seiton: { ...emptyNc },
    seiso: { ...emptyNc },
    seiketsu: { ...emptyNc },
    shitsuke: { ...emptyNc },
  });
  const [ncResponsavel, setNcResponsavel] = useState("");
  const [ncResponsavelEmail, setNcResponsavelEmail] = useState("");
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

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const percentual = (total / 50) * 100;
  const cls = classificaPontuacao(percentual);

  const handleSave = async () => {
    if (!areaId || !auditorId) {
      toast.error("Selecione a área e o auditor");
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

    // Gerar ações corretivas para critérios marcados como Não Conforme
    const ncRows = CRITERIOS_5S
      .filter((c) => ncs[c.key].marked)
      .map((c) => {
        const n = ncs[c.key];
        return {
          auditoria_id: inserted.id,
          area_id: areaId,
          criterio: c.nome,
          descricao: n.descricao.trim() || `Não conformidade identificada em ${c.nome}`,
          severidade: "media",
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
            return (
              <div key={c.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary">
                      {c.nome} <span className="font-normal text-muted-foreground">· {c.titulo}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  <div className="grid place-items-center h-10 w-14 rounded-md bg-primary text-primary-foreground font-bold text-lg shrink-0">
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
                <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={ncs[c.key].marked}
                      onCheckedChange={(v) =>
                        setNcs((n) => ({
                          ...n,
                          [c.key]: { ...n[c.key], marked: v === true },
                        }))
                      }
                    />
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium">Marcar como Não Conforme</span>
                    <span className="text-xs text-muted-foreground">
                      (gera ação corretiva automaticamente)
                    </span>
                  </label>
                  {ncs[c.key].marked && (
                    <Textarea
                      value={ncs[c.key].descricao}
                      onChange={(e) =>
                        setNcs((n) => ({
                          ...n,
                          [c.key]: { ...n[c.key], descricao: e.target.value },
                        }))
                      }
                      placeholder={`Descreva a não conformidade em ${c.nome}...`}
                      rows={2}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
