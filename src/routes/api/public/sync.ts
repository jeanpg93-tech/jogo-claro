// Endpoint público para CRON externo (pg_cron, GitHub Actions, etc.).
// Autenticado por header x-sync-secret (segredo SYNC_SECRET).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SYNC_SECRET;
        if (!secret) {
          return new Response("SYNC_SECRET não configurada no servidor.", {
            status: 503,
          });
        }
        const header = request.headers.get("x-sync-secret") ?? "";
        if (header !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runSync } = await import("@/lib/sync-core.server");
        const result = await runSync();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
      GET: async ({ request }) => {
        // Permitir GET para schedulers mais simples (mesma proteção).
        const secret = process.env.SYNC_SECRET;
        if (!secret) {
          return new Response("SYNC_SECRET não configurada no servidor.", {
            status: 503,
          });
        }
        const header = request.headers.get("x-sync-secret") ?? "";
        if (header !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runSync } = await import("@/lib/sync-core.server");
        const result = await runSync();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
