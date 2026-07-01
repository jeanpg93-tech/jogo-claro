import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const EXEMPT_PATHS = new Set<string>(["/perfil-analitico", "/jogo-responsavel"]);

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth/entrar" });

    // Onboarding: se o perfil analítico ainda não foi concluído, envia para a
    // tela de completude — exceto se já está lá ou em rotas isentas.
    if (!EXEMPT_PATHS.has(location.pathname)) {
      try {
        const { data: prefs } = await supabase
          .from("user_preferences")
          .select("analytical_profile_completed_at")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!prefs?.analytical_profile_completed_at) {
          throw redirect({ to: "/perfil-analitico" });
        }
      } catch (err) {
        // Se o redirect foi lançado, propagar; caso contrário, tolerar erro e
        // deixar o app continuar funcionando (critério: app não quebra sem perfil).
        if (err && typeof err === "object" && "isRedirect" in err) throw err;
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
