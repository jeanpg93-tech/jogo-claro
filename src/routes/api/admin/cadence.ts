// Endpoint admin: retorna a decisão de cadência adaptativa da sincronização.
// Auth: Bearer <access_token> + verificação de role admin.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/cadence")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { verifyAdminFromToken, getCadenceStatusAdmin } = await import(
          "@/lib/sync-core.server"
        );
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const status = await getCadenceStatusAdmin();
        return Response.json(status);
      },
    },
  },
});
