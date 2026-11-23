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
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, Info, Camera } from "lucide-react";
import { CRITERIOS_5S, ESCALA_PONTUACAO, classificaPontuacao, type Criterio5SKey } from "@/lib/audit-constants";
import { AuditPhotos } from "@/components/AuditPhotos";
import { useProcessAuditManager } from "@/hooks/use-process-audit-permission";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/auditorias/$id_/editar")({
  head: () => ({ meta: [{ title: "Editar Auditoria 5S | AuditLog" }, { name: "description", content: "Corrija as notas de uma auditoria 5S concluída." }, { property: "og:title", content: "Editar Auditoria 5S | AuditLog" }, { property: "og:description", content: "Correção de auditorias 5S concluídas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: EditarAuditoria,
});

function EditarAuditoria() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const auditQ = useQuery({
    queryKey: ["auditoria-editar", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*, areas(nome), auditores(nome, email)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
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

  const audit = auditQ.data as any;
  const canManage = useProcessAuditManager([audit?.auditor_id]);

  const [auditorId, setAuditorId] = useState("");
  const [data, setData] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [scores, setScores] = useState<Record<Criterio5SKey, number>>({ seiri: 0, seiton: 0, seiso: 0, seiketsu: 0, shitsuke: 0 } as Record<Criterio5SKey, number>);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!audit) return;
    setAuditorId(audit.auditor_id ?? "");
    setData(audit.data_auditoria);
    setObservacoes(audit.observacoes ?? "");
    setScores({ seiri: audit.seiri, seiton: audit.seiton, seiso: audit.seiso, seiketsu: audit.seiketsu, shitsuke: audit.shitsuke } as Record<Criterio5SKey, number>);
  }, [audit?.id]);

  if (auditQ.isLoading || canManage.loading) return <div className="p-8">Carregando...</div>;

  const blocked = !audit ? "Auditoria não encontrada ou sem acesso." :
    audit.status !== "concluida" ? "Somente auditorias concluídas podem ser editadas." :
    !canManage(audit.auditor_id) ? "Você não tem permissão para editar esta auditoria." : "";
  if (blocked) {
    return (
      <div className="p-8 space-y-4 max-w-xl mx-auto">
        <p>{blocked}</p>
        <Button asChild variant="outline"><Link to="/auditorias">Voltar</Link></Button>
      </div>
    );
  }

  const total = CRITERIOS_5S.reduce((s, c) => s + (scores[c.key] ?? 0), 0);
  const percentual = (total / 50) * 100;
  const cls = classificaPontuacao(percentual);

  const salvar = async () => {
    if (!auditorId) { toast.error("Selecione o auditor."); return; }
    setSaving(true);
    const { error } = await (supabase.rpc as any)("edit_completed_audit", {
      p_id: id,
      p_audit: { area_id: audit.area_id, auditor_id: auditorId, data_auditoria: data, ...scores, pontuacao_total: total, percentual, observacoes: observacoes || null },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Auditoria atualizada.");
    qc.invalidateQueries({ queryKey: ["auditoria", id] });
    qc.invalidateQueries({ queryKey: ["auditoria-editar", id] });
    navigate({ to: "/auditorias/$id", params: { id } });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/auditorias/$id" params={{ id }}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Editar Auditoria 5S</h1>
        <p className="text-sm text-muted-foreground">Correção de notas. Não conformidades não são alteradas por aqui.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados gerais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Área</Label>
            <p className="h-10 flex items-center font-medium">{audit.areas?.nome ?? "—"}</p>
          </div>
          <div>
            <Label>Auditor</Label>
            <Select value={auditorId} onValueChange={setAuditorId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(auditoresQ.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
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
        <CardHeader><CardTitle className="text-base">Avaliação dos 5 Sensos</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {CRITERIOS_5S.map((c) => {
            const val = scores[c.key] ?? 0;
            const boxClass = val < 4 ? "bg-red-600 text-white" : val < 6 ? "bg-amber-500 text-white" : val < 8 ? "bg-amber-300 text-amber-950" : "bg-primary text-primary-foreground";
            return (
              <div key={c.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary flex items-center gap-1.5">
                      {c.nome} <span className="font-normal text-muted-foreground">· {c.titulo}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-primary" aria-label="Ver critérios de pontuação">
                            <Info className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-xs space-y-2">
                          <p className="font-semibold text-sm">Critérios de pontuação</p>
                          {ESCALA_PONTUACAO.map((e) => (
                            <div key={e.faixa} className="flex gap-2">
                              <span className="font-bold w-14 shrink-0">{e.faixa}</span>
                              <span><span className="font-medium">{e.titulo}.</span> <span className="text-muted-foreground">{e.descricao}</span></span>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  <div className={`grid place-items-center h-10 w-14 rounded-md font-bold text-lg shrink-0 ${boxClass}`}>{val}</div>
                </div>
                <Slider value={[val]} min={0} max={10} step={1} onValueChange={(v) => setScores((s) => ({ ...s, [c.key]: v[0] ?? 0 }))} />
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm">Total: <b>{total}/50</b></span>
            <span className={`rounded-md px-3 py-1 font-bold ${cls.color}`}>{percentual.toFixed(0)}% · {cls.label}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
        <CardContent><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} /></CardContent>
      </Card>

      {Array.isArray(audit.fotos) && audit.fotos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Fotos ({audit.fotos.length})</CardTitle></CardHeader>
          <CardContent><AuditPhotos paths={audit.fotos as string[]} /></CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline"><Link to="/auditorias/$id" params={{ id }}>Cancelar</Link></Button>
        <Button onClick={salvar} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar alterações"}</Button>
      </div>
    </div>
  );
}
