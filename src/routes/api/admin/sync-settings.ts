// Endpoint admin para ler/salvar competições sincronizadas.
// Auth: Bearer <access_token> + verificação de role admin.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sync-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { verifyAdminFromToken, getSelectedSportsAdmin } = await import(
          "@/lib/sync-core.server"
        );
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const sports = await getSelectedSportsAdmin();
        return Response.json({ sports });
      },
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { verifyAdminFromToken, setSelectedSportsAdmin } = await import(
          "@/lib/sync-core.server"
        );
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const body = (await request.json().catch(() => ({}))) as {
          sports?: unknown;
        };
        if (!Array.isArray(body.sports)) {
          return Response.json({ error: "sports inválido" }, { status: 400 });
        }
        const sports = body.sports.map(String);
        await setSelectedSportsAdmin(sports);
        return Response.json({ ok: true, sports });
      },
    },
  },
});
