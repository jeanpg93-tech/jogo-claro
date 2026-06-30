// Lista ao vivo os torneios disponíveis no OddsPapi (sportId=10, futebol).
// Útil para o admin descobrir os slugs reais a usar no seletor.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/oddspapi-tournaments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { verifyAdminFromToken } = await import("@/lib/sync-core.server");
        const isAdmin = await verifyAdminFromToken(token);
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        const apiKey = process.env.ODDSPAPI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { ok: false, error: "ODDSPAPI_API_KEY não configurada." },
            { status: 500 },
          );
        }
        const { ODDSPAPI_HEADERS } = await import("@/lib/providers/oddspapi.server");
        const res = await fetch(
          `https://api.oddspapi.io/v4/tournaments?sportId=10&language=pt&apiKey=${encodeURIComponent(apiKey)}`,
          { headers: ODDSPAPI_HEADERS },
        );
        const text = await res.text();
        if (!res.ok) {
          return Response.json(
            { ok: false, status: res.status, body: text.slice(0, 1000) },
            { status: 502 },
          );
        }
        const data = JSON.parse(text) as Array<{
          tournamentId: number;
          tournamentSlug: string;
          tournamentName: string;
          categoryName?: string;
          futureFixtures?: number;
          upcomingFixtures?: number;
          liveFixtures?: number;
        }>;
        return Response.json({ ok: true, count: data.length, tournaments: data });
      },
    },
  },
});
