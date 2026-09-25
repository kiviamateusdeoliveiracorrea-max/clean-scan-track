import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type OrphanRow = {
  name: string;
  path: string;
  size: number;
  created_at: string | null;
  mime: string | null;
  origem: string;
  relacionado: string | null;
  relacionadoId: string | null;
  status: string;
  justificativa: string | null;
  acao: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_LABEL: Record<string, string> = {
  EM_ANALISE: "Em análise",
  MANTIDO: "Mantido",
  ARQUIVADO: "Arquivado",
  VINCULADO: "Vinculado",
  EXCLUIDO: "Excluído",
};

function guessOrigin(path: string): string {
  const first = path.split("/")[0];
  if (first === "alertas") return "Alerta de processo";
  if (first === "melhorias") return "Melhoria";
  if (first === "gemba") return "Gemba";
  if (/\/nc-/.test(path)) return "Evidência de pergunta NÃO (auditoria)";
  if (/\/auditoria-/.test(path)) return "Foto geral de auditoria";
  if (/^nc\/|tratativa|resol|doc/i.test(path)) return "Tratativa de NC";
  return "Não identificada";
}

async function requireAdmin(admin: any, userId: string) {
  const [{ data: roles }, { data: uup }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin
      .from("user_unit_permissions")
      .select("role")
      .eq("user_id", userId)
      .eq("active", true)
      .eq("validation_status", "VALIDADO")
      .in("role", ["ADMIN_GLOBAL", "ADMIN_UNIDADE"]),
  ]);
  return (roles ?? []).some((r: any) => r.role === "administrador") || (uup ?? []).length > 0;
}

async function listAllFiles(admin: any) {
  const files: { path: string; size: number; created_at: string | null; mime: string | null }[] = [];
  const walk = async (prefix: string) => {
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from("audit-photos").list(prefix, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const it of data ?? []) {
        const full = prefix ? `${prefix}/${it.name}` : it.name;
        if (!it.id) await walk(full);
        else
          files.push({
            path: full,
            size: Number(it.metadata?.size ?? 0),
            created_at: it.created_at ?? null,
            mime: it.metadata?.mimetype ?? null,
          });
      }
      if ((data ?? []).length < 1000) break;
      offset += 1000;
    }
  };
  await walk("");
  return files;
}

async function referencedPaths(admin: any) {
  const refs = new Set<string>();
  const add = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === "string") refs.add(v);
  };
  const qs = await Promise.all([
    admin.from("auditorias").select("fotos"),
    admin.from("respostas_auditoria").select("foto_url"),
    admin.from("nao_conformidades").select("foto_url, foto_urls, documento_urls"),
    admin.from("melhorias").select("foto_urls"),
    admin.from("gemba_visitas").select("foto_antes_urls, foto_depois_urls"),
    admin.from("alertas_processo").select("foto_urls"),
  ]);
  for (const q of qs) {
    if (q.error) throw new Error(q.error.message);
    for (const row of q.data ?? []) Object.values(row as any).forEach(add);
  }
  return refs;
}

export const listOrphanFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    if (!(await requireAdmin(admin, context.userId)))
      return { allowed: false, rows: [] as OrphanRow[], total: 0, failures: 0, events: 0 };

    const [files, refs] = await Promise.all([listAllFiles(admin), referencedPaths(admin)]);
    const orphans = files.filter((f) => !refs.has(f.path));
    const paths = orphans.map((o) => o.path);
    const safe = paths.length ? paths : ["__none__"];

    const [{ data: reviews }, { data: detected }, { data: fails }, { count: evCount }, auds, ncs] =
      await Promise.all([
        admin.from("orphan_file_reviews").select("*").in("path", safe),
        admin.from("evidence_events").select("path").eq("event", "ORFAO_DETECTADO").in("path", safe),
        admin.from("evidence_upload_failures").select("paths, rollback_ok"),
        admin.from("evidence_events").select("id", { count: "exact", head: true }),
        admin.from("auditorias").select("id, data_auditoria, unit_id, areas(nome)"),
        admin.from("nao_conformidades").select("id, criterio, unit_id"),
      ]);
    const rev = new Map((reviews ?? []).map((r: any) => [r.path, r]));
    const det = new Set((detected ?? []).map((d: any) => d.path));
    const failed = new Set<string>();
    for (const f of (fails ?? []) as any[]) if (!f.rollback_ok) (f.paths ?? []).forEach((p: string) => failed.add(p));
    const audMap = new Map((auds.data ?? []).map((a: any) => [a.id, a]));
    const ncMap = new Map((ncs.data ?? []).map((n: any) => [n.id, n]));

    // Registra detecção uma única vez por arquivo.
    const newDetect = orphans.filter((o) => !det.has(o.path));
    if (newDetect.length)
      await admin.from("evidence_events").insert(
        newDetect.map((o) => {
          const seg = o.path.split("/")[0];
          return {
            user_id: context.userId,
            event: "ORFAO_DETECTADO",
            context: "monitor-orfaos",
            record_id: UUID.test(seg) ? seg : null,
            unit_id: (audMap.get(seg) as any)?.unit_id ?? null,
            path: o.path,
            mime: o.mime,
            size_bytes: o.size,
            result: "DETECTADO",
          };
        }),
      );

    const rows: OrphanRow[] = orphans
      .map((f) => {
        const segs = f.path.split("/");
        const cand = segs.find((s) => UUID.test(s)) ?? null;
        const a: any = cand ? audMap.get(cand) : null;
        const n: any = cand ? ncMap.get(cand) : null;
        const relacionado = a
          ? `Auditoria ${a.areas?.nome ?? ""} de ${new Date(a.data_auditoria).toLocaleDateString("pt-BR")}`
          : n
            ? `NC: ${String(n.criterio).slice(0, 60)}`
            : cand
              ? "Registro não encontrado (possivelmente excluído)"
              : null;
        const r: any = rev.get(f.path);
        const status = r ? STATUS_LABEL[r.status] ?? r.status : failed.has(f.path) ? "Falha de rollback" : "Em análise";
        const acao = r?.status === "ARQUIVADO" || r?.status === "MANTIDO"
          ? "Nenhuma (decisão registrada)"
          : a
            ? "Vincular à auditoria relacionada"
            : cand && !n
              ? "Excluir após validação"
              : "Manter para análise";
        return {
          ...f,
          name: segs[segs.length - 1],
          origem: guessOrigin(f.path),
          relacionado,
          relacionadoId: a ? cand : null,
          status,
          justificativa: r?.justification ?? null,
          acao,
        };
      })
      .sort((x, y) => (x.created_at ?? "").localeCompare(y.created_at ?? ""));

    return { allowed: true, rows, total: files.length, failures: (fails ?? []).length, events: evCount ?? 0 };
  });

export const reviewOrphanFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        path: z.string().min(3).max(500),
        action: z.enum(["MANTER", "ARQUIVAR", "VINCULAR", "EXCLUIR"]),
        justification: z.string().trim().min(5, "Informe uma justificativa (mín. 5 caracteres).").max(500),
        auditoriaId: z.string().uuid().optional(),
        confirm: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    if (!(await requireAdmin(admin, context.userId))) throw new Error("Acesso negado.");

    // Revalida no servidor que o arquivo existe e continua sem vínculo.
    const refs = await referencedPaths(admin);
    if (refs.has(data.path)) throw new Error("Este arquivo já está vinculado a um registro.");
    const dir = data.path.split("/").slice(0, -1).join("/");
    const name = data.path.split("/").pop()!;
    const { data: listed } = await admin.storage.from("audit-photos").list(dir, { search: name });
    const meta = (listed ?? []).find((x: any) => x.name === name);
    if (!meta) throw new Error("Arquivo não encontrado no armazenamento.");
    const mime = (meta.metadata as any)?.mimetype ?? null;
    const size = Number((meta.metadata as any)?.size ?? 0);

    let status = "";
    let event = "";
    let unitId: string | null = null;
    let recordId: string | null = null;
    let linked: string | null = null;

    if (data.action === "MANTER") { status = "MANTIDO"; event = "ORFAO_MANTIDO"; }
    if (data.action === "ARQUIVAR") { status = "ARQUIVADO"; event = "ORFAO_ARQUIVADO"; }
    if (data.action === "VINCULAR") {
      if (!data.auditoriaId) throw new Error("Informe a auditoria para vincular.");
      const { data: au, error } = await admin.from("auditorias").select("id, fotos, unit_id").eq("id", data.auditoriaId).single();
      if (error || !au) throw new Error("Auditoria não encontrada.");
      const { error: e2 } = await admin.from("auditorias").update({ fotos: [...(au.fotos ?? []), data.path] }).eq("id", au.id);
      if (e2) throw new Error("Não foi possível vincular: " + e2.message);
      status = "VINCULADO"; event = "ORFAO_VINCULADO"; unitId = au.unit_id; recordId = au.id; linked = `auditorias:${au.id}`;
    }
    if (data.action === "EXCLUIR") {
      if (data.confirm !== "EXCLUIR") throw new Error('Digite EXCLUIR para confirmar a exclusão.');
      const { data: prev } = await admin.from("orphan_file_reviews").select("status").eq("path", data.path).maybeSingle();
      if (!prev || !["MANTIDO", "ARQUIVADO"].includes(prev.status))
        return { ok: false, status: "", error: "Exclusão só é permitida após validação: marque o arquivo como Mantido ou Arquivado antes." };
      const { error } = await admin.storage.from("audit-photos").remove([data.path]);
      if (error) throw new Error("Não foi possível excluir: " + error.message);
      status = "EXCLUIDO"; event = "LIMPEZA_ORFAO";
    }

    await admin.from("orphan_file_reviews").upsert({
      path: data.path,
      status,
      justification: data.justification,
      linked_record: linked,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    });
    await admin.from("evidence_events").insert({
      user_id: context.userId,
      event,
      context: "monitor-orfaos",
      record_id: recordId,
      unit_id: unitId,
      path: data.path,
      mime,
      size_bytes: size,
      result: status,
      detail: data.justification,
    });
    return { ok: true, status };
  });
