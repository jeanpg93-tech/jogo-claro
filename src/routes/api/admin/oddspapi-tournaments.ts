// Lista ao vivo os torneios disponíveis no OddsPapi (sportId=10, futebol).
// Útil para o admin descobrir os slugs reais a usar no seletor.
import { createFileRoute } from "@tanstack/react-router";
import { ODDSPAPI_TOURNAMENTS } from "@/lib/oddspapi-catalog";

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
        type TournamentDto = {
          tournamentId: number;
          tournamentSlug: string;
          tournamentName: string;
          categoryName?: string;
          futureFixtures?: number;
          upcomingFixtures?: number;
          liveFixtures?: number;
        };

        const catalogUrl = new URL("https://api.oddspapi.io/v4/tournaments");
        catalogUrl.searchParams.set("sportId", "10");
        catalogUrl.searchParams.set("language", "pt");
        catalogUrl.searchParams.set("apiKey", apiKey);

        const catalogRes = await fetch(catalogUrl.toString(), { headers: ODDSPAPI_HEADERS });
        const catalogText = await catalogRes.text();
        if (catalogRes.ok) {
          const data = JSON.parse(catalogText) as TournamentDto[];
          return Response.json({ ok: true, count: data.length, tournaments: data });
        }

        // Algumas chaves bloqueiam /tournaments com 403, mas permitem /fixtures.
        // Então listamos torneios a partir dos jogos futuros, sem transformar isso
        // em erro de tela.
        const discovered = new Map<number, TournamentDto>();
        const today = new Date();
        const ymd = (d: Date) => d.toISOString().slice(0, 10);
        const addDays = (d: Date, days: number) => {
          const n = new Date(d);
          n.setUTCDate(n.getUTCDate() + days);
          return n;
        };
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        let cursor = addDays(today, -1);
        const until = addDays(today, 35);
        while (cursor.getTime() < until.getTime()) {
          const to = addDays(cursor, 5);
          const url = new URL("https://api.oddspapi.io/v4/fixtures");
          url.searchParams.set("sportId", "10");
          url.searchParams.set("from", ymd(cursor));
          url.searchParams.set("to", ymd(to.getTime() < until.getTime() ? to : until));
          url.searchParams.set("statusId", "0");
          url.searchParams.set("hasOdds", "true");
          url.searchParams.set("language", "pt");
          url.searchParams.set("apiKey", apiKey);
          const res = await fetch(url.toString(), { headers: ODDSPAPI_HEADERS });
          if (res.ok) {
            const fixtures = (await res.json().catch(() => [])) as Array<{
              tournamentId?: number;
              tournamentSlug?: string;
              tournamentName?: string;
              categoryName?: string;
            }>;
            for (const f of fixtures) {
              if (!f.tournamentId || !f.tournamentName) continue;
              discovered.set(f.tournamentId, {
                tournamentId: f.tournamentId,
                tournamentSlug: f.tournamentSlug ?? String(f.tournamentId),
                tournamentName: f.tournamentName,
                categoryName: f.categoryName,
                futureFixtures: (discovered.get(f.tournamentId)?.futureFixtures ?? 0) + 1,
              });
            }
          }
          cursor = to;
          if (cursor.getTime() < until.getTime()) await wait(2_100);
        }

        if (discovered.size > 0) {
          const tournaments = Array.from(discovered.values()).sort((a, b) =>
            a.tournamentName.localeCompare(b.tournamentName, "pt-BR"),
          );
          return Response.json({
            ok: true,
            count: tournaments.length,
            tournaments,
            warning: "Catálogo bloqueado pela OddsPapi; lista montada pelos jogos futuros disponíveis.",
          });
        }

        const fallback = ODDSPAPI_TOURNAMENTS.map((t, index) => ({
          tournamentId: index + 1,
          tournamentSlug: t.slug,
          tournamentName: t.label,
          categoryName: t.group,
          futureFixtures: 0,
        }));
        return Response.json({
          ok: true,
          count: fallback.length,
          tournaments: fallback,
          warning: `A OddsPapi bloqueou a listagem ao vivo (${catalogRes.status}); exibindo o catálogo local.`,
          providerBody: catalogText.slice(0, 300),
        });
      },
    },
  },
});
