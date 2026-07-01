// Fase 6 — Endpoint da Análise Assistida (uma por jogo, cacheada, server-side).
//
// GET  /api/assisted-reading?gameId=xxx
//   → devolve a última análise salva (se houver) + status do provedor +
//     flag "stale" se as odds mudaram desde a última geração.
// POST /api/assisted-reading            body: { gameId }
//   → gera nova análise se cache expirou/input mudou; senão devolve cache.
// POST /api/assisted-reading?force=1    body: { gameId }
//   → força regeneração. RESTRITO A ADMIN. Usuário comum recebe 403.
//
// O frontend NÃO envia o pacote de dados da análise. O servidor lê games/odds/reference
// no Supabase e monta o input objetivo internamente.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assisted-reading")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const {
          verifyUserFromToken,
          getProviderStatus,
          getProviderHealth,
          readLatestReading,
          buildAssistedReadingInputFromDb,
          hashInput,
        } = await import("@/lib/assisted-reading.server");
        const userId = await verifyUserFromToken(token);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const gameId = url.searchParams.get("gameId");
        const provider = getProviderStatus();
        const health = getProviderHealth();
        if (!gameId) return Response.json({ provider, health, reading: null, stale: false });
        const reading = await readLatestReading(gameId);
        let stale = false;
        if (reading) {
          const input = await buildAssistedReadingInputFromDb(gameId);
          if (input) stale = hashInput(input) !== reading.inputHash;
        }
        return Response.json({ provider, health, reading, stale });
      },
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const {
          verifyUserFromToken,
          verifyAdminFromToken,
          getProviderStatus,
          getProviderHealth,
          hashInput,
          readCachedReading,
          readLatestReading,
          callProvider,
          saveReading,
          containsForbidden,
          checkAndIncrementQuota,
          recordProviderSuccess,
          recordProviderFailure,
          buildAssistedReadingInputFromDb,
        } = await import("@/lib/assisted-reading.server");

        const userId = await verifyUserFromToken(token);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const wantsForce = url.searchParams.get("force") === "1";

        // Força só é permitida para admin — evita abuso de cota por usuário comum.
        let force = false;
        if (wantsForce) {
          const isAdmin = await verifyAdminFromToken(token);
          if (!isAdmin) {
            return Response.json(
              {
                status: "error",
                message:
                  "Regeneração forçada é reservada para administradores. A análise em cache continua válida.",
              },
              { status: 403 },
            );
          }
          force = true;
        }

        const body = (await request.json().catch(() => ({}))) as { gameId?: string };
        const gameId = String(body.gameId ?? "").trim();
        if (!gameId) {
          return Response.json({ status: "error", message: "gameId ausente." }, { status: 400 });
        }

        // Servidor monta o input a partir do Supabase — nunca aceita o pacote do cliente.
        const input = await buildAssistedReadingInputFromDb(gameId);
        if (!input) {
          return Response.json(
            { status: "error", message: "Jogo não encontrado no banco." },
            { status: 404 },
          );
        }
        const inputHash = hashInput(input);

        // 1) Cache válido para este hash?
        if (!force) {
          const cached = await readCachedReading(gameId, inputHash);
          if (cached && cached.fresh) {
            return Response.json({ status: "ready", reading: cached, fromCache: true, stale: false });
          }
        }

        // 2) Provedor configurado?
        const st = getProviderStatus();
        if (!st.configured) {
          const last = await readLatestReading(gameId);
          return Response.json({
            status: "not_configured",
            provider: st.provider,
            message: st.reason,
            reading: last,
            stale: last ? last.inputHash !== inputHash : false,
          });
        }

        // 3) Quota diária
        const quota = await checkAndIncrementQuota();
        if (!quota.ok) {
          const last = await readLatestReading(gameId);
          return Response.json(
            {
              status: "quota_exceeded",
              message: `Limite diário atingido (${quota.used}/${quota.limit}).`,
              reading: last,
              stale: last ? last.inputHash !== inputHash : false,
            },
            { status: 429 },
          );
        }

        // 4) Chama provedor externo
        let out;
        try {
          out = await callProvider(input);
          recordProviderSuccess();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "falha no provedor";
          recordProviderFailure(msg);
          console.error("[assisted-reading] provider failed:", msg);
          const last = await readLatestReading(gameId);
          const isRate = /429|rate.?limit|sobrecarreg|overload/i.test(msg);
          return Response.json({
            status: "error",
            message: isRate
              ? "O provedor de IA está sobrecarregado agora. Aguarde alguns minutos e tente de novo — a análise anterior continua disponível abaixo."
              : "A análise por IA ficou indisponível por alguns instantes. Tente novamente em breve.",
            detail: process.env.NODE_ENV === "development" ? msg : undefined,
            health: getProviderHealth(),
            reading: last,
            stale: last ? last.inputHash !== inputHash : false,
          });
        }

        if (!out.payload.resumo) {
          recordProviderFailure("resposta incompleta do provedor");
          const last = await readLatestReading(gameId);
          return Response.json({
            status: "error",
            message: "A IA não retornou uma análise completa. Tente gerar novamente.",
            health: getProviderHealth(),
            reading: last,
            stale: last ? last.inputHash !== inputHash : false,
          });
        }
        const forbidden = containsForbidden(out.payload);
        if (forbidden) {
          return Response.json(
            {
              status: "blocked",
              message: `Saída rejeitada: termo proibido "${forbidden}".`,
            },
            { status: 422 },
          );
        }

        // 5) Persiste
        const saved = await saveReading({
          gameId,
          provider: st.provider,
          model: st.model ?? "",
          inputHash,
          status: out.payload.status,
          payload: out.payload,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
        });

        return Response.json({ status: "ready", reading: saved, fromCache: false, stale: false });
      },
    },
  },
});
