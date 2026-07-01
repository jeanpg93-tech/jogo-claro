// Endpoint do botão "Sincronizar agora" do painel Admin.
// Autenticado por Authorization: Bearer <access_token> do usuário logado +
// verificação de role admin via service role.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

          const { verifyAdminFromToken, runSync } = await import(
            "@/lib/sync-core.server"
          );
          const isAdmin = await verifyAdminFromToken(token);
          if (!isAdmin) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

          const result = await runSync({ force: true });
          return Response.json(result, { status: 200 });
        } catch (error) {
          console.error("[api/admin/sync] erro inesperado:", error);
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Erro inesperado na sincronização.",
              results: [],
              gamesInserted: 0,
              gamesUpdated: 0,
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
