// Endpoint admin para ler/salvar configurações de sincronização.
// Auth: Bearer <access_token> + verificação de role admin.
//
// GET  -> retorna sports (The Odds API), providers, oddspapi { tournaments, bookmakers }
// POST -> aceita { sports?, providers?, oddspapi? } (todos opcionais; salva o que vier)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sync-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const {
          verifyAdminFromToken,
          getSelectedSportsAdmin,
          getProvidersStatusAdmin,
          getOddsPapiSettingsAdmin,
        } = await import("@/lib/sync-core.server");
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const [sports, providers, oddspapi] = await Promise.all([
          getSelectedSportsAdmin(),
          getProvidersStatusAdmin(),
          getOddsPapiSettingsAdmin(),
        ]);
        return Response.json({ sports, providers, oddspapi });
      },
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const {
          verifyAdminFromToken,
          setSelectedSportsAdmin,
          setProvidersEnabledAdmin,
          setOddsPapiSettingsAdmin,
          getSelectedSportsAdmin,
          getProvidersStatusAdmin,
          getOddsPapiSettingsAdmin,
        } = await import("@/lib/sync-core.server");
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const body = (await request.json().catch(() => ({}))) as {
          sports?: unknown;
          providers?: Partial<Record<"the-odds-api" | "oddspapi", boolean>>;
          oddspapi?: { tournaments?: unknown; bookmakers?: unknown };
        };

        if (Array.isArray(body.sports)) {
          await setSelectedSportsAdmin(body.sports.map(String));
        }
        if (body.providers && typeof body.providers === "object") {
          await setProvidersEnabledAdmin(body.providers);
        }
        if (body.oddspapi) {
          const tournaments = Array.isArray(body.oddspapi.tournaments)
            ? body.oddspapi.tournaments.map(String)
            : undefined;
          const bookmakers = Array.isArray(body.oddspapi.bookmakers)
            ? body.oddspapi.bookmakers.map(String)
            : undefined;
          await setOddsPapiSettingsAdmin({ tournaments, bookmakers });
        }

        const [sports, providers, oddspapi] = await Promise.all([
          getSelectedSportsAdmin(),
          getProvidersStatusAdmin(),
          getOddsPapiSettingsAdmin(),
        ]);
        return Response.json({ ok: true, sports, providers, oddspapi });
      },
    },
  },
});
