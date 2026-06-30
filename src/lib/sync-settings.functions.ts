// Server functions para configuração de competições sincronizadas.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSelectedSports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "selected_sports")
      .maybeSingle();
    const value = (data?.value ?? null) as { sports?: string[] } | null;
    return { sports: value?.sports ?? [] };
  });

export const setSelectedSports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sports: string[] }) => {
    if (!Array.isArray(input?.sports)) throw new Error("sports inválido");
    return { sports: input.sports.map(String) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert(
      { key: "selected_sports", value: { sports: data.sports } },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, sports: data.sports };
  });
