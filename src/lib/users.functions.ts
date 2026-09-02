import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeUserEmail } from "@/lib/email-normalization";

const ROLES = ["administrador", "auditor", "gestor", "consulta"] as const;
export type AppRole = (typeof ROLES)[number];

async function assertManager(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["administrador", "gestor"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Acesso negado: apenas administradores ou gestores podem realizar esta ação.");
  }
}

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        nome: z.string().trim().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeUserEmail(data.email);

    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "administrador");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("Já existe um administrador. Solicite acesso a um administrador.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const signupClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: created, error } = await signupClient.auth.signUp({
      email,
      password: data.password,
      options: { data: { nome: data.nome, role: "administrador" } },
    });
    if (error) throw new Error(error.message);


    if (created.user?.id) {
      await supabaseAdmin.from("profiles").upsert({
        id: created.user.id,
        nome: data.nome,
        email,
        ativo: true,
      });
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: created.user.id, role: "administrador" },
        { onConflict: "user_id,role" },
      );
    }

    return { ok: true, userId: created.user?.id };
  });

export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "administrador");
  if (error) throw new Error(error.message);
  return { needs: (count ?? 0) === 0 };
});

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r: any) => r.role as AppRole) };
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(["ativos", "inativos", "todos"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const status = data?.status ?? "ativos";
    const { data: callerRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isManager = (callerRoles ?? []).some((r: any) =>
      r.role === "administrador" || r.role === "gestor",
    );

    let query = context.supabase
      .from("profiles")
      .select("id, nome, email, cargo, area_id, ativo, deve_alterar_senha, created_at, areas(nome)")
      .order("created_at", { ascending: false });
    if (status === "ativos") query = query.eq("ativo", true);
    else if (status === "inativos") query = query.eq("ativo", false);

    const { data: profiles, error: pErr } = await query;
    if (pErr) {
      console.error("[listUsers] profiles error", pErr);
      throw new Error(pErr.message);
    }

    const { data: roles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("user_id, role");
    if (rErr) {
      console.error("[listUsers] user_roles error", rErr);
      throw new Error(rErr.message);
    }

    const byUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      byUser.set(r.user_id, list);
    }
    return (profiles ?? []).map((p: any) => ({
      ...p,
      email: isManager || p.id === context.userId ? p.email : null,
      area_nome: p.areas?.nome ?? null,
      roles: byUser.get(p.id) ?? [],
    }));
  });



export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        nome: z.string().trim().min(1).max(100),
        role: z.enum(ROLES),
        cargo: z.string().trim().max(100).optional().nullable(),
        area_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeUserEmail(data.email);

    const { createClient } = await import("@supabase/supabase-js");
    const signupClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: created, error } = await signupClient.auth.signUp({
      email,
      password: data.password,
      options: {
        data: {
          nome: data.nome,
          role: data.role,
          cargo: data.cargo ?? "",
          area_id: data.area_id ?? "",
        },
      },
    });
    if (error) throw new Error(error.message);


    if (created.user?.id) {
      await supabaseAdmin.from("profiles").upsert({
        id: created.user.id,
        nome: data.nome,
        email,
        cargo: data.cargo ?? null,
        area_id: data.area_id ?? null,
        ativo: true,
      });
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: created.user.id, role: data.role },
        { onConflict: "user_id,role" },
      );
    }

    return { ok: true, userId: created.user?.id };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.userId === context.userId) {
      if (data.role !== "administrador") {
        throw new Error("Você não pode remover o próprio perfil de administrador.");
      }
      return { ok: true };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        nome: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().email().max(255).optional(),
        cargo: z.string().trim().max(100).nullable().optional(),
        area_id: z.string().uuid().nullable().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      nome?: string;
      email?: string;
      cargo?: string | null;
      area_id?: string | null;
      ativo?: boolean;
    } = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.email !== undefined) patch.email = normalizeUserEmail(data.email);
    if (data.cargo !== undefined) patch.cargo = data.cargo;
    if (data.area_id !== undefined) patch.area_id = data.area_id;
    if (data.ativo !== undefined) patch.ativo = data.ativo;

    if (patch.email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: patch.email,
      });
      if (authErr) throw new Error(authErr.message);
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: false })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    return { ok: true };
  });

// ===================== Administração de contas =====================

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "administrador");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Acesso negado: apenas administradores podem realizar esta ação.");
  }
}

async function logAdminAction(
  admin: any,
  params: {
    acao: string;
    targetUserId?: string | null;
    targetNome?: string | null;
    targetEmail?: string | null;
    executadoPor: string;
    detalhes?: string | null;
  },
) {
  const { data: me } = await admin
    .from("profiles")
    .select("nome")
    .eq("id", params.executadoPor)
    .maybeSingle();
  await admin.from("admin_logs").insert({
    acao: params.acao,
    target_user_id: params.targetUserId ?? null,
    target_user_nome: params.targetNome ?? null,
    target_user_email: params.targetEmail ?? null,
    executado_por: params.executadoPor,
    executado_por_nome: (me as any)?.nome ?? null,
    detalhes: params.detalhes ?? null,
  });
}

/** Limpa a exigência de troca de senha do próprio usuário (após alterar a senha). */
export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deve_alterar_senha: false })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Dados da própria conta. */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email, cargo, ativo, deve_alterar_senha, created_at, areas(nome)")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      profile: data as any,
      roles: (roles ?? []).map((r: any) => r.role as AppRole),
    };
  });

/** Envia link de recuperação de senha (admin). */
export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), redirectTo: z.string().url().max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .eq("id", data.userId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    const email = (target as any)?.email;
    if (!email) throw new Error("Usuário sem e-mail cadastrado.");

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);

    await logAdminAction(supabaseAdmin, {
      acao: "envio_link_redefinicao_senha",
      targetUserId: data.userId,
      targetNome: (target as any)?.nome,
      targetEmail: email,
      executadoPor: context.userId,
    });
    return { ok: true };
  });

/** Define senha temporária e obriga troca no próximo login (admin). */
export const adminSetTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), password: z.string().min(8).max(72) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (authErr) throw new Error(authErr.message);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deve_alterar_senha: true })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("id", data.userId)
      .maybeSingle();
    await logAdminAction(supabaseAdmin, {
      acao: "senha_temporaria_definida",
      targetUserId: data.userId,
      targetNome: (target as any)?.nome,
      targetEmail: (target as any)?.email,
      executadoPor: context.userId,
      detalhes: "Usuário deverá criar nova senha no próximo acesso.",
    });
    return { ok: true };
  });

async function countActiveAdmins(admin: any) {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, profiles:user_id(ativo)")
    .eq("role", "administrador");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r: any) => r.profiles?.ativo !== false).length;
}

/** Ativa ou desativa um usuário (admin). */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Você não pode desativar o próprio cadastro.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.ativo) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .eq("role", "administrador");
      if ((roles ?? []).length > 0 && (await countActiveAdmins(supabaseAdmin)) <= 1) {
        throw new Error("Não é possível desativar o último administrador ativo.");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("id", data.userId)
      .maybeSingle();
    await logAdminAction(supabaseAdmin, {
      acao: data.ativo ? "usuario_reativado" : "usuario_desativado",
      targetUserId: data.userId,
      targetNome: (target as any)?.nome,
      targetEmail: (target as any)?.email,
      executadoPor: context.userId,
    });
    return { ok: true };
  });

/** Verifica vínculos do usuário antes da exclusão. */
export const getUserLinkedRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: string, column: string) => {
      const { count: c } = await supabaseAdmin
        .from(table as any)
        .select("*", { count: "exact", head: true })
        .eq(column, data.userId);
      return c ?? 0;
    };
    const [ncResp, ncAcao, ncAprov, melhorias, gemba, auditoriasCanc] = await Promise.all([
      count("nao_conformidades", "responsavel_nc_id"),
      count("nao_conformidades", "responsavel_acao_id"),
      count("nao_conformidades", "aprovador_id"),
      count("melhorias", "responsavel_id"),
      count("gemba_visitas", "responsavel_id"),
      count("auditorias", "cancelada_por"),
    ]);
    const total = ncResp + ncAcao + ncAprov + melhorias + gemba + auditoriasCanc;
    return {
      total,
      detalhes: {
        nao_conformidades: ncResp + ncAcao + ncAprov,
        melhorias,
        gemba: gemba,
        auditorias: auditoriasCanc,
      },
    };
  });

/**
 * Exclui o acesso do usuário (autenticação) preservando todo o histórico.
 * O cadastro permanece como "Usuário excluído" para manter as referências.
 */
export const deleteUserPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir o próprio cadastro.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "administrador");
    if ((roles ?? []).length > 0 && (await countActiveAdmins(supabaseAdmin)) <= 1) {
      throw new Error("Não é possível excluir o último administrador ativo.");
    }

    // 1) remove permissões
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (rErr) throw new Error(rErr.message);

    // 2) mantém o cadastro como referência histórica anonimizada
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: "Usuário excluído",
        email: null,
        ativo: false,
        deve_alterar_senha: false,
      })
      .eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);

    // 3) remove o login (somente no servidor)
    const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (aErr) throw new Error(aErr.message);

    await logAdminAction(supabaseAdmin, {
      acao: "usuario_excluido",
      targetUserId: data.userId,
      targetNome: (target as any)?.nome,
      targetEmail: (target as any)?.email,
      executadoPor: context.userId,
      detalhes: "Acesso removido; histórico de auditorias e tratativas preservado.",
    });
    return { ok: true };
  });

/** Log administrativo (somente administradores). */
export const listAdminLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
