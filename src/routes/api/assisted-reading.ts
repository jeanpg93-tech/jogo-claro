// Fase 5 — Endpoint da Leitura Assistida.
// Auth: Bearer <access_token> (qualquer usuário autenticado).
//
// POST /api/assisted-reading
// body: { gameId: string, input: AssistedReadingInput }
// resp: { status: "ready"|"not_configured"|"blocked"|"error", reading?, provider?, model?, message? }
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assisted-reading")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { verifyUserFromToken, getProviderStatus } = await import(
          "@/lib/assisted-reading.server"
        );
        const userId = await verifyUserFromToken(token);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        return Response.json(getProviderStatus());
      },
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const {
          verifyUserFromToken,
          getProviderStatus,
          hashInput,
          readCachedReading,
          callProvider,
          saveReading,
          containsForbidden,
        } = await import("@/lib/assisted-reading.server");

        const userId = await verifyUserFromToken(token);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as {
          gameId?: string;
          input?: unknown;
        };
        const gameId = String(body.gameId ?? "").trim();
        if (!gameId || !body.input || typeof body.input !== "object") {
          return Response.json({ status: "error", message: "payload inválido" }, { status: 400 });
        }
        const input = body.input as import("@/lib/assisted-reading").AssistedReadingInput;
        const inputHash = hashInput(input);

        // 1) Cache 30 min por (gameId, inputHash)
        const cached = await readCachedReading(gameId, inputHash);
        if (cached && cached.fresh) {
          return Response.json({
            status: "ready",
            reading: cached,
            fromCache: true,
          });
        }

        // 2) Provedor configurado?
        const st = getProviderStatus();
        if (!st.configured) {
          return Response.json({
            status: "not_configured",
            provider: st.provider,
            message: st.reason,
          });
        }

        // 3) Chama provedor externo
        let out;
        try {
          out = await callProvider(input);
        } catch (err) {
          return Response.json(
            {
              status: "error",
              message: err instanceof Error ? err.message : "falha no provedor",
            },
            { status: 502 },
          );
        }

        if (!out.summary) {
          return Response.json({ status: "error", message: "resposta vazia" }, { status: 502 });
        }
        const forbidden = containsForbidden(out.summary + " " + out.cautions.join(" "));
        if (forbidden) {
          return Response.json(
            {
              status: "blocked",
              message: `Saída rejeitada: termo proibido "${forbidden}".`,
            },
            { status: 422 },
          );
        }

        // 4) Persiste
        const saved = await saveReading({
          gameId,
          provider: st.provider,
          model: st.model ?? "",
          inputHash,
          summary: out.summary,
          cautions: out.cautions,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
        });

        return Response.json({ status: "ready", reading: saved, fromCache: false });
      },
    },
  },
});
