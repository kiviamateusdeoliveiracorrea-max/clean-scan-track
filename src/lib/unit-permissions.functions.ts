import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const UNIT_ROLES = [
  "ADMIN_GLOBAL",
  "ADMIN_UNIDADE",
  "ANALISTA",
  "LIDER",
  "COORDENADOR",
  "GERENTE",
  "CONSULTOR",
] as const;
export type UnitRole = (typeof UNIT_ROLES)[number];
const AREA_REQUIRED: UnitRole[] = ["LIDER", "COORDENADOR", "GERENTE", "CONSULTOR"];

type Access = { isGlobal: boolean; adminUnits: string[] };

async function getAccess(admin: any, userId: string): Promise<Access> {
  const { data, error } = await admin
    .from("user_unit_permissions")
    .select("unit_id, role, active, validation_status, units!inner(active)")
    .eq("user_id", userId)
    .eq("active", true)
    .eq("validation_status", "VALIDADO")
    .in("role", ["ADMIN_GLOBAL", "ADMIN_UNIDADE"]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r: any) => r.units?.active);
  return {
    isGlobal: rows.some((r: any) => r.role === "ADMIN_GLOBAL"),
    adminUnits: rows.map((r: any) => r.unit_id),
  };
}

async function requireAccess(admin: any, userId: string) {
  const acc = await getAccess(admin, userId);
  if (!acc.isGlobal && acc.adminUnits.length === 0) {
    throw new Error("Acesso negado: somente administradores globais ou da unidade.");
  }
  return acc;
}

export const getMyUnitAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await getAccess(supabaseAdmin, context.userId);
    return { ...acc, allowed: acc.isGlobal || acc.adminUnits.length > 0 };
  });

export const listUnitPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const acc = await requireAccess(admin, context.userId);

    let uupQ = admin
      .from("user_unit_permissions")
      .select("id, user_id, unit_id, role, active, is_default_unit, validation_status, justification, observation, updated_at");
    if (!acc.isGlobal) uupQ = uupQ.in("unit_id", acc.adminUnits);
    const { data: uup, error: e1 } = await uupQ;
    if (e1) throw new Error(e1.message);
    const userIds = [...new Set((uup ?? []).map((r: any) => r.user_id))];

    const [profilesR, rolesR, uapR, areasR, unitsR, authR] = await Promise.all([
      admin.from("profiles").select("id, nome, email, ativo, excluido, area_id").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("user_roles").select("user_id, role").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("user_area_permissions").select("user_id, unit_id, area_id, active").eq("active", true),
      admin.from("areas").select("id, nome, unit_id, active").order("nome"),
      admin.from("units").select("id, name, code, active").order("name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    for (const r of [profilesR, rolesR, uapR, areasR, unitsR]) if (r.error) throw new Error(r.error.message);

    const lastSignIn = new Map<string, string | null>();
    for (const u of authR.data?.users ?? []) lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    const profiles = new Map((profilesR.data ?? []).map((p: any) => [p.id, p]));
    const units = (unitsR.data ?? []).filter((u: any) => acc.isGlobal || acc.adminUnits.includes(u.id));

    const rows = (uup ?? []).map((r: any) => {
      const p: any = profiles.get(r.user_id) ?? {};
      return {
        ...r,
        nome: p.nome ?? null,
        email: p.email ?? null,
        conta_ativa: p.ativo !== false && !p.excluido,
        excluido: !!p.excluido,
        area_principal_id: p.area_id ?? null,
        papeis_globais: (rolesR.data ?? []).filter((x: any) => x.user_id === r.user_id).map((x: any) => x.role),
        area_ids: (uapR.data ?? [])
          .filter((x: any) => x.user_id === r.user_id && x.unit_id === r.unit_id)
          .map((x: any) => x.area_id),
        ultimo_acesso: lastSignIn.get(r.user_id) ?? null,
      };
    });
    return {
      rows,
      units,
      areas: (areasR.data ?? []).filter((a: any) => units.some((u: any) => u.id === a.unit_id)),
      me: context.userId,
      isGlobal: acc.isGlobal,
    };
  });

const saveSchema = z.object({
  permissionId: z.string().uuid(),
  mode: z.enum(["pending", "validate", "areas", "deactivate"]),
  role: z.enum(UNIT_ROLES).nullable(),
  areaIds: z.array(z.string().uuid()).max(50),
  isDefault: z.boolean(),
  justification: z.string().trim().max(1000),
  observation: z.string().trim().max(1000).optional().default(""),
});

export const saveUnitPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const acc = await requireAccess(admin, context.userId);

    const { data: cur, error } = await admin
      .from("user_unit_permissions").select("*").eq("id", data.permissionId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!cur) throw new Error("Permissão não encontrada.");
    if (cur.user_id === context.userId) throw new Error("Você não pode alterar o próprio papel ou acesso.");
    if (!acc.isGlobal && !acc.adminUnits.includes(cur.unit_id)) {
      await admin.from("unit_audit_log").insert({
        unit_id: cur.unit_id, user_id: context.userId, action: "ACESSO_NEGADO",
        entity: "user_unit_permissions", entity_id: cur.user_id,
        justification: "Tentativa de administrar usuário de outra unidade",
      });
      throw new Error("Acesso negado: você só administra a própria unidade.");
    }
    const touchesGlobal = cur.role === "ADMIN_GLOBAL" || data.role === "ADMIN_GLOBAL";
    if (touchesGlobal && !acc.isGlobal) {
      throw new Error("Somente um ADMIN_GLOBAL pode atribuir ou remover ADMIN_GLOBAL.");
    }

    const newRole = data.mode === "areas" ? cur.role : data.role;
    const newActive = data.mode !== "deactivate" && (data.mode === "areas" ? cur.active : true);
    const removingGlobal =
      cur.role === "ADMIN_GLOBAL" && cur.active && (newRole !== "ADMIN_GLOBAL" || !newActive);
    if (removingGlobal) {
      const { data: gl } = await admin
        .from("user_unit_permissions").select("user_id")
        .eq("role", "ADMIN_GLOBAL").eq("active", true).eq("validation_status", "VALIDADO");
      if ((gl ?? []).length < 2) {
        throw new Error("É preciso ter pelo menos dois ADMIN_GLOBAL ativos antes de rebaixar ou desativar um deles.");
      }
    }

    // Áreas: todas devem pertencer à unidade
    const { data: unitAreas } = await admin.from("areas").select("id").eq("unit_id", cur.unit_id);
    const valid = new Set((unitAreas ?? []).map((a: any) => a.id));
    if (data.areaIds.some((id) => !valid.has(id))) throw new Error("Área não pertence à unidade.");

    const just = data.justification;
    if (just.length < 5) throw new Error("Informe uma justificativa (mínimo 5 caracteres).");

    const hasArea = data.areaIds.length > 0;
    let status: string;
    if (data.mode === "deactivate") status = "INATIVO";
    else if (data.mode === "validate") {
      if (!newRole) throw new Error("Selecione o papel local para validar.");
      if (AREA_REQUIRED.includes(newRole as UnitRole) && !hasArea && just.length < 15) {
        throw new Error("Este papel exige área. Para manter sem área, detalhe a exceção na justificativa (mínimo 15 caracteres).");
      }
      status = "VALIDADO";
    } else if (data.mode === "areas") {
      status = cur.validation_status;
      if (status === "VALIDADO" && newRole && AREA_REQUIRED.includes(newRole as UnitRole) && !hasArea && just.length < 15) {
        throw new Error("Este papel exige área. Detalhe a exceção na justificativa (mínimo 15 caracteres).");
      }
    } else {
      status = !newRole && !hasArea ? "PENDENTE_PAPEL_E_AREA" : !newRole ? "PENDENTE_PAPEL" : !hasArea ? "PENDENTE_AREA" : "PENDENTE_PAPEL";
    }

    const { data: prevAreasRows } = await admin
      .from("user_area_permissions").select("area_id")
      .eq("user_id", cur.user_id).eq("unit_id", cur.unit_id).eq("active", true);
    const prevAreas = (prevAreasRows ?? []).map((r: any) => r.area_id).sort();
    const nextAreas = [...data.areaIds].sort();

    const { error: uErr } = await admin.from("user_unit_permissions").update({
      role: newRole, active: newActive, validation_status: status,
      is_default_unit: data.isDefault, justification: just,
      observation: data.observation || null, updated_by: context.userId,
    }).eq("id", cur.id);
    if (uErr) throw new Error(uErr.message);

    if (data.mode !== "deactivate" && JSON.stringify(prevAreas) !== JSON.stringify(nextAreas)) {
      const removed = prevAreas.filter((a: string) => !nextAreas.includes(a));
      if (removed.length) {
        const { error: rErr } = await admin.from("user_area_permissions")
          .update({ active: false, updated_by: context.userId })
          .eq("user_id", cur.user_id).in("area_id", removed);
        if (rErr) throw new Error(rErr.message);
      }
      if (nextAreas.length) {
        const { error: aErr } = await admin.from("user_area_permissions").upsert(
          nextAreas.map((a) => ({ user_id: cur.user_id, unit_id: cur.unit_id, area_id: a, active: true, created_by: context.userId, updated_by: context.userId })),
          { onConflict: "user_id,area_id" },
        );
        if (aErr) throw new Error(aErr.message);
      }
    }

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", cur.user_id);
    await admin.from("unit_audit_log").insert({
      unit_id: cur.unit_id, user_id: context.userId,
      action: { pending: "SALVAR_PENDENTE", validate: "VALIDAR_PAPEL", areas: "ATUALIZAR_AREAS", deactivate: "DESATIVAR_ACESSO" }[data.mode],
      entity: "user_unit_permissions", entity_id: cur.user_id,
      previous_value: { role: cur.role, validation_status: cur.validation_status, active: cur.active, areas: prevAreas, is_default_unit: cur.is_default_unit },
      new_value: {
        role: newRole, validation_status: status, active: newActive,
        areas: data.mode === "deactivate" ? prevAreas : nextAreas, is_default_unit: data.isDefault,
        papel_global_user_roles: (roles ?? []).map((r: any) => r.role), observation: data.observation || null,
      },
      justification: just,
    });
    return { ok: true, status };
  });
