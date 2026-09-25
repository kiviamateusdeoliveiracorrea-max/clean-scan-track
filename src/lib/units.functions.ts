import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function myPerms(admin: any, userId: string) {
  const { data, error } = await admin
    .from("user_unit_permissions")
    .select("unit_id, role, validation_status, is_default_unit, units!inner(id, code, name, active, status, is_test)")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r: any) => r.units?.active);
  const isGlobal = rows.some((r: any) => r.role === "ADMIN_GLOBAL" && r.validation_status === "VALIDADO");
  const adminUnits = rows
    .filter((r: any) => r.role === "ADMIN_UNIDADE" && r.validation_status === "VALIDADO")
    .map((r: any) => r.unit_id as string);
  return { rows, isGlobal, adminUnits };
}

async function requireGlobal(admin: any, userId: string) {
  const p = await myPerms(admin, userId);
  if (!p.isGlobal) throw new Error("Acesso negado: somente ADMIN_GLOBAL.");
  return p;
}

async function requireUnitAdmin(admin: any, userId: string, unitId: string) {
  const p = await myPerms(admin, userId);
  if (!p.isGlobal && !p.adminUnits.includes(unitId)) throw new Error("Acesso negado para esta unidade.");
  return p;
}

async function audit(admin: any, row: Record<string, unknown>) {
  await admin.from("unit_audit_log").insert(row);
}

/** Unidades que o usuário pode selecionar no cabeçalho. */
export const getMyUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const p = await myPerms(admin, context.userId);
    let units: { id: string; code: string; name: string; status: string }[];
    if (p.isGlobal) {
      const { data } = await admin
        .from("units").select("id, code, name, status").eq("active", true).eq("is_test", false).order("name");
      units = data ?? [];
    } else {
      units = p.rows
        .filter((r: any) => !r.units.is_test)
        .map((r: any) => ({ id: r.units.id, code: r.units.code, name: r.units.name, status: r.units.status }));
    }
    const def = p.rows.find((r: any) => r.is_default_unit)?.unit_id ?? units[0]?.id ?? null;
    return { units, defaultUnitId: def, isGlobal: p.isGlobal, adminUnits: p.adminUnits };
  });

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    await requireGlobal(admin, context.userId);
    const [u, a, p, prof] = await Promise.all([
      admin.from("units").select("*").eq("is_test", false).order("name"),
      admin.from("areas").select("id, unit_id, nome, setor, descricao, code, active, updated_at").order("nome"),
      admin.from("user_unit_permissions").select("user_id, unit_id, role, active, validation_status"),
      admin.from("profiles").select("id, nome, email, ativo, excluido").eq("ativo", true).eq("excluido", false).order("nome"),
    ]);
    for (const r of [u, a, p, prof]) if (r.error) throw new Error(r.error.message);
    const names = new Map((prof.data ?? []).map((x: any) => [x.id, x.nome || x.email]));
    const units = (u.data ?? []).map((un: any) => {
      const perms = (p.data ?? []).filter((x: any) => x.unit_id === un.id && x.active);
      return {
        ...un,
        users: perms.length,
        areas: (a.data ?? []).filter((x: any) => x.unit_id === un.id),
        admins: perms.filter((x: any) => x.role === "ADMIN_UNIDADE").map((x: any) => names.get(x.user_id) ?? "—"),
      };
    });
    return { units, profiles: (prof.data ?? []).map((x: any) => ({ id: x.id, nome: x.nome || x.email })) };
  });

const createSchema = z.object({
  code: z.string().trim().min(2).max(10).regex(/^[A-Za-z0-9_-]+$/, "Código: só letras, números, - e _"),
  name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
  observation: z.string().trim().max(500).optional().nullable(),
  adminUserId: z.string().uuid().optional().nullable(),
});

export const createUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await requireGlobal(admin, context.userId);
    const code = data.code.toUpperCase();
    const { data: dup } = await admin.from("units").select("id").ilike("code", code).maybeSingle();
    if (dup) return { ok: false as const, error: `Já existe uma unidade com o código ${code}.` };
    const { data: unit, error } = await admin
      .from("units")
      .insert({
        code, name: data.name, company_name: data.company_name || null, city: data.city || null,
        state: data.state ? data.state.toUpperCase() : null, observation: data.observation || null,
        status: "EM_CONFIGURACAO", active: true, created_by: context.userId, updated_by: context.userId,
      })
      .select("id").single();
    if (error) return { ok: false as const, error: error.message };
    await audit(admin, {
      unit_id: unit.id, user_id: context.userId, action: "UNIDADE_CRIADA", entity: "units", entity_id: unit.id,
      new_value: { code, name: data.name, status: "EM_CONFIGURACAO" },
    });
    if (data.adminUserId) {
      const r = await setAdminInternal(admin, context.userId, unit.id, data.adminUserId);
      if (!r.ok) return { ok: true as const, id: unit.id, warning: r.error };
    }
    return { ok: true as const, id: unit.id };
  });

async function setAdminInternal(admin: any, actor: string, unitId: string, userId: string) {
  if (userId === actor) return { ok: false, error: "Você não pode alterar o próprio papel." };
  const { data: ex } = await admin.from("user_unit_permissions").select("id, role").eq("user_id", userId).eq("unit_id", unitId).maybeSingle();
  if (ex?.role === "ADMIN_GLOBAL") return { ok: false, error: "Usuário já é ADMIN_GLOBAL." };
  const row = {
    role: "ADMIN_UNIDADE", active: true, validation_status: "VALIDADO", updated_by: actor,
    justification: "Definido como administrador no cadastro da unidade",
  };
  const res = ex
    ? await admin.from("user_unit_permissions").update(row).eq("id", ex.id)
    : await admin.from("user_unit_permissions").insert({ ...row, user_id: userId, unit_id: unitId, is_default_unit: false, created_by: actor });
  if (res.error) return { ok: false, error: res.error.message };
  await audit(admin, {
    unit_id: unitId, user_id: actor, action: "ADMIN_UNIDADE_DEFINIDO", entity: "user_unit_permissions", entity_id: userId,
    previous_value: ex ? { role: ex.role } : null, new_value: { role: "ADMIN_UNIDADE" },
  });
  return { ok: true };
}

export const setUnitAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ unitId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await requireGlobal(admin, context.userId);
    return setAdminInternal(admin, context.userId, data.unitId, data.userId);
  });

export const setUnitStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    unitId: z.string().uuid(),
    status: z.enum(["ATIVA", "INATIVA"]),
    justification: z.string().trim().min(5).max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const p = await requireGlobal(admin, context.userId);
    const { data: cur } = await admin.from("units").select("id, status, active").eq("id", data.unitId).single();
    if (!cur) return { ok: false, error: "Unidade não encontrada." };
    if (data.status === "INATIVA" && p.rows.some((r: any) => r.unit_id === data.unitId && r.role === "ADMIN_GLOBAL")) {
      return { ok: false, error: "Não é possível inativar a unidade que concede seu acesso de ADMIN_GLOBAL." };
    }
    const { error } = await admin.from("units")
      .update({ status: data.status, active: data.status === "ATIVA", updated_by: context.userId }).eq("id", data.unitId);
    if (error) return { ok: false, error: error.message };
    await audit(admin, {
      unit_id: data.unitId, user_id: context.userId, action: data.status === "ATIVA" ? "UNIDADE_ATIVADA" : "UNIDADE_INATIVADA",
      entity: "units", entity_id: data.unitId, previous_value: { status: cur.status }, new_value: { status: data.status },
      justification: data.justification,
    });
    return { ok: true };
  });

const areaSchema = z.object({
  unitId: z.string().uuid(),
  id: z.string().uuid().optional().nullable(),
  nome: z.string().trim().min(2).max(80),
  setor: z.string().trim().max(80).optional().nullable(),
  descricao: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().optional(),
});

export const saveUnitArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => areaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await requireUnitAdmin(admin, context.userId, data.unitId);
    const { data: same } = await admin.from("areas").select("id").eq("unit_id", data.unitId).ilike("nome", data.nome);
    if ((same ?? []).some((x: any) => x.id !== data.id)) return { ok: false, error: "Já existe uma área com esse nome nesta unidade." };
    const row: any = { nome: data.nome, setor: data.setor || null, descricao: data.descricao || null };
    if (data.active !== undefined) row.active = data.active;
    let id = data.id;
    let prev: any = null;
    if (id) {
      const { data: cur } = await admin.from("areas").select("*").eq("id", id).single();
      if (!cur || cur.unit_id !== data.unitId) return { ok: false, error: "Área não pertence a esta unidade." };
      prev = { nome: cur.nome, setor: cur.setor, active: cur.active };
      const { error } = await admin.from("areas").update(row).eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: ins, error } = await admin.from("areas").insert({ ...row, unit_id: data.unitId, active: true }).select("id").single();
      if (error) return { ok: false, error: error.message };
      id = ins.id;
    }
    await audit(admin, {
      unit_id: data.unitId, user_id: context.userId,
      action: !data.id ? "AREA_CRIADA" : data.active === false ? "AREA_INATIVADA" : data.active === true && prev && !prev.active ? "AREA_REATIVADA" : "AREA_EDITADA",
      entity: "areas", entity_id: id, previous_value: prev, new_value: row,
    });
    return { ok: true };
  });

/** Copia apenas a estrutura (perguntas/checklist e opcionalmente os nomes das áreas) da unidade modelo. */
export const copyTemplateFromUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUnitId: z.string().uuid(),
    sourceCode: z.string().default("MOT"),
    copyAreas: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await requireGlobal(admin, context.userId);
    const { data: src } = await admin.from("units").select("id, code").eq("code", data.sourceCode).single();
    if (!src) return { ok: false, error: "Unidade modelo não encontrada." };
    if (src.id === data.targetUnitId) return { ok: false, error: "A unidade modelo não pode receber a cópia." };

    const { data: existingQ } = await admin.from("perguntas_auditoria").select("id").eq("unit_id", data.targetUnitId).limit(1);
    if ((existingQ ?? []).length) return { ok: false, error: "Esta unidade já possui perguntas. A cópia não foi repetida." };

    // Perguntas do modelo: as da própria unidade modelo + as globais (sem unidade)
    const { data: qs, error: qe } = await admin.from("perguntas_auditoria")
      .select("area_nome, categoria, pergunta, peso, ativo").or(`unit_id.is.null,unit_id.eq.${src.id}`);
    if (qe) return { ok: false, error: qe.message };
    let perguntas = 0;
    if ((qs ?? []).length) {
      const { error } = await admin.from("perguntas_auditoria").insert(qs.map((q: any) => ({ ...q, unit_id: data.targetUnitId })));
      if (error) return { ok: false, error: error.message };
      perguntas = qs.length;
    }

    let areas = 0;
    if (data.copyAreas) {
      const [{ data: srcAreas }, { data: tgtAreas }] = await Promise.all([
        admin.from("areas").select("nome, setor, descricao").eq("unit_id", src.id).eq("active", true),
        admin.from("areas").select("nome").eq("unit_id", data.targetUnitId),
      ]);
      const have = new Set((tgtAreas ?? []).map((a: any) => a.nome.toLowerCase()));
      const toIns = (srcAreas ?? []).filter((a: any) => !have.has(a.nome.toLowerCase()))
        .map((a: any) => ({ ...a, unit_id: data.targetUnitId, active: true }));
      if (toIns.length) {
        const { error } = await admin.from("areas").insert(toIns);
        if (error) return { ok: false, error: error.message };
        areas = toIns.length;
      }
    }
    await audit(admin, {
      unit_id: data.targetUnitId, user_id: context.userId, action: "MODELO_COPIADO", entity: "units", entity_id: data.targetUnitId,
      new_value: { origem: src.code, perguntas, areas },
    });
    return { ok: true, perguntas, areas };
  });
