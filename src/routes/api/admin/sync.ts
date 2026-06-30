// Endpoint do botão "Sincronizar agora" do painel Admin.
// Autenticado por Authorization: Bearer <access_token> do usuário logado +
// verificação de role admin via service role.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { verifyAdminFromToken, runSync } = await import(
          "@/lib/sync-core.server"
        );
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const result = await runSync();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
