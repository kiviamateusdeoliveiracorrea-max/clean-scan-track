import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrphanRow = {
  path: string;
  size: number;
  created_at: string | null;
  mime: string | null;
  origem: string;
  status: string;
  acao: string;
};

function guessOrigin(path: string): string {
  const first = path.split("/")[0];
  if (first === "alertas") return "Alerta de processo";
  if (first === "melhorias") return "Melhoria";
  if (first === "gemba") return "Gemba";
  if (/^nc-|\/nc-/.test(path)) return "Evidência de pergunta NÃO (auditoria)";
  if (/\/auditoria-/.test(path)) return "Foto geral de auditoria";
  if (/tratativa|resol|doc/i.test(path)) return "Tratativa de NC";
  return "Não identificada";
}

export const listOrphanFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: uup }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", context.userId),
      admin
        .from("user_unit_permissions")
        .select("role")
        .eq("user_id", context.userId)
        .eq("active", true)
        .eq("validation_status", "VALIDADO")
        .in("role", ["ADMIN_GLOBAL", "ADMIN_UNIDADE"]),
    ]);
    const allowed =
      (roles ?? []).some((r: any) => r.role === "administrador") || (uup ?? []).length > 0;
    if (!allowed) return { allowed: false, rows: [] as OrphanRow[], total: 0, failures: 0 };

    // Todos os arquivos do bucket (listagem recursiva).
    const files: { path: string; size: number; created_at: string | null; mime: string | null }[] = [];
    const walk = async (prefix: string) => {
      let offset = 0;
      for (;;) {
        const { data, error } = await admin.storage
          .from("audit-photos")
          .list(prefix, { limit: 1000, offset });
        if (error) throw new Error(error.message);
        for (const it of data ?? []) {
          const full = prefix ? `${prefix}/${it.name}` : it.name;
          if (!it.id) await walk(full);
          else
            files.push({
              path: full,
              size: Number((it.metadata as any)?.size ?? 0),
              created_at: it.created_at ?? null,
              mime: (it.metadata as any)?.mimetype ?? null,
            });
        }
        if ((data ?? []).length < 1000) break;
        offset += 1000;
      }
    };
    await walk("");

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

    const { data: fails } = await admin
      .from("evidence_upload_failures" as any)
      .select("paths, rollback_ok");
    const failedPaths = new Set<string>();
    for (const f of (fails ?? []) as any[])
      if (!f.rollback_ok) (f.paths ?? []).forEach((p: string) => failedPaths.add(p));

    const rows: OrphanRow[] = files
      .filter((f) => !refs.has(f.path))
      .map((f) => ({
        ...f,
        origem: guessOrigin(f.path),
        status: failedPaths.has(f.path) ? "Falha de rollback registrada" : "Em análise",
        acao: failedPaths.has(f.path)
          ? "Remover após confirmação do administrador"
          : "Manter para análise (não excluir)",
      }))
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

    return { allowed: true, rows, total: files.length, failures: (fails ?? []).length };
  });
