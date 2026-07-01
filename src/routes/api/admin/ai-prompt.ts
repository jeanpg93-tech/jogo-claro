// Endpoint admin para gerenciar prompts versionados da IA.
// GET  -> lista versões do prompt "system_main" e devolve o template default.
// POST -> cria uma nova versão { content, notes?, activate? } — não sobrescreve versões anteriores.
// PUT  -> ativa uma versão específica { id }.
import { createFileRoute } from "@tanstack/react-router";

async function requireAdmin(request: Request): Promise<string | Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { verifyAdminFromToken, verifyUserFromToken } = await import(
    "@/lib/assisted-reading.server"
  );
  const isAdmin = await verifyAdminFromToken(token);
  if (!isAdmin) return new Response("Forbidden", { status: 403 });
  const userId = await verifyUserFromToken(token);
  if (!userId) return new Response("Unauthorized", { status: 401 });
  return userId;
}

export const Route = createFileRoute("/api/admin/ai-prompt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAdmin(request);
        if (gate instanceof Response) return gate;
        const { listPromptsAdmin, DEFAULT_SYSTEM_PROMPT_TEMPLATE } = await import(
          "@/lib/assisted-reading.server"
        );
        const prompts = await listPromptsAdmin("system_main");
        return Response.json({
          prompts,
          defaultTemplate: DEFAULT_SYSTEM_PROMPT_TEMPLATE,
        });
      },
      POST: async ({ request }) => {
        const gate = await requireAdmin(request);
        if (gate instanceof Response) return gate;
        const userId = gate;
        const body = (await request.json().catch(() => ({}))) as {
          content?: string;
          notes?: string | null;
          activate?: boolean;
        };
        const content = String(body.content ?? "").trim();
        if (content.length < 60) {
          return Response.json(
            { error: "Prompt muito curto (mínimo 60 caracteres)." },
            { status: 400 },
          );
        }
        const { createPromptAdmin } = await import("@/lib/assisted-reading.server");
        const row = await createPromptAdmin({
          content,
          notes: body.notes ?? null,
          createdBy: userId,
          activate: Boolean(body.activate),
        });
        return Response.json({ ok: true, prompt: row });
      },
      PUT: async ({ request }) => {
        const gate = await requireAdmin(request);
        if (gate instanceof Response) return gate;
        const body = (await request.json().catch(() => ({}))) as { id?: string };
        if (!body.id) return new Response("Bad Request", { status: 400 });
        const { activatePromptAdmin } = await import("@/lib/assisted-reading.server");
        await activatePromptAdmin(body.id);
        return Response.json({ ok: true });
      },
    },
  },
});
