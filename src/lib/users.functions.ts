import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeUserEmail } from "@/lib/email-normalization";

const ROLES = ["administrador", "auditor", "gestor", "consulta"] as const;
export type AppRole = (typeof ROLES)[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "administrador")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: apenas administradores");
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

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome, role: "administrador" },
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

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, cargo, area_id, ativo, created_at, areas(nome)")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const byUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      byUser.set(r.user_id, list);
    }
    return (profiles ?? []).map((p: any) => ({
      ...p,
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeUserEmail(data.email);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        role: data.role,
        cargo: data.cargo ?? "",
        area_id: data.area_id ?? "",
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
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
        cargo: z.string().trim().max(100).nullable().optional(),
        area_id: z.string().uuid().nullable().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      nome?: string;
      cargo?: string | null;
      area_id?: string | null;
      ativo?: boolean;
    } = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.cargo !== undefined) patch.cargo = data.cargo;
    if (data.area_id !== undefined) patch.area_id = data.area_id;
    if (data.ativo !== undefined) patch.ativo = data.ativo;

    const { error } = await (supabaseAdmin.from("profiles") as any)
      .update(patch)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ ativo: false }).eq("id", data.userId);
    return { ok: true };
  });
