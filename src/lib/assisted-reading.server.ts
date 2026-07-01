// Fase 5 — Backend da "Leitura assistida".
// Executa apenas no servidor. Nunca importe este arquivo do cliente.
//
// Regras firmes:
// - Não usa IA nativa do Lovable no produto final. O provedor é escolhido
//   por env `ASSISTED_AI_PROVIDER` e a chave fica em Secret server-side.
// - Cache por jogo com TTL de 30 min. Se o `input_hash` mudar (odds mudaram)
//   invalida cedo e regenera na próxima chamada.
// - Sanitiza a saída contra termos proibidos antes de persistir.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { AssistedReadingInput } from "./assisted-reading";

export const CACHE_TTL_MIN = 30;

const FORBIDDEN = [
  "aposte agora",
  "aposte",
  "palpite certeiro",
  "palpite infal",
  "palpite",
  "lucro certo",
  "lucro",
  "renda extra",
  "renda",
  "garantido",
  "certeza",
  "infalível",
  "infalivel",
  "robô vencedor",
  "robo vencedor",
];

export type ProviderId = "" | "lovable" | "openai" | "anthropic";

export interface ProviderStatus {
  provider: ProviderId;
  configured: boolean;
  model: string | null;
  reason?: string;
}

export function getProviderStatus(): ProviderStatus {
  const raw = (process.env.ASSISTED_AI_PROVIDER ?? "").trim().toLowerCase();
  const provider = (["lovable", "openai", "anthropic"].includes(raw) ? raw : "") as ProviderId;
  if (!provider) {
    return { provider: "", configured: false, model: null, reason: "ASSISTED_AI_PROVIDER não definido" };
  }
  if (provider === "lovable") {
    const ok = Boolean(process.env.LOVABLE_API_KEY);
    return {
      provider,
      configured: ok,
      model: process.env.ASSISTED_AI_MODEL ?? "google/gemini-3-flash-preview",
      reason: ok ? undefined : "LOVABLE_API_KEY ausente",
    };
  }
  if (provider === "openai") {
    const ok = Boolean(process.env.OPENAI_API_KEY);
    return {
      provider,
      configured: ok,
      model: process.env.ASSISTED_AI_MODEL ?? "gpt-4o-mini",
      reason: ok ? undefined : "OPENAI_API_KEY ausente",
    };
  }
  const ok = Boolean(process.env.ANTHROPIC_API_KEY);
  return {
    provider,
    configured: ok,
    model: process.env.ASSISTED_AI_MODEL ?? "claude-3-5-haiku-latest",
    reason: ok ? undefined : "ANTHROPIC_API_KEY ausente",
  };
}

function getAdmin() {
  const url = process.env.EXT_SUPABASE_URL;
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("EXT_SUPABASE_URL e EXT_SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hashInput(input: AssistedReadingInput): string {
  // Ignora `updatedAtISO` no hash — só invalida quando o *conteúdo* muda.
  const clone = { ...input, updatedAtISO: null };
  return createHash("sha256").update(JSON.stringify(clone)).digest("hex");
}

export async function verifyUserFromToken(token: string): Promise<string | null> {
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export interface CachedReading {
  id: string;
  gameId: string;
  provider: string;
  model: string;
  createdAt: string;
  inputHash: string;
  summary: string;
  cautions: string[];
  ageMin: number;
  fresh: boolean;
}

export async function readCachedReading(
  gameId: string,
  inputHash: string,
): Promise<CachedReading | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("ai_readings")
    .select("id, game_id, provider, model, created_at, input_hash, summary, cautions")
    .eq("game_id", gameId)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  const ageMin = Math.round(ageMs / 60000);
  return {
    id: data.id,
    gameId: data.game_id,
    provider: data.provider,
    model: data.model,
    createdAt: data.created_at,
    inputHash: data.input_hash,
    summary: data.summary,
    cautions: Array.isArray(data.cautions) ? data.cautions : [],
    ageMin,
    fresh: ageMin < CACHE_TTL_MIN,
  };
}

export function containsForbidden(text: string): string | null {
  const low = text.toLowerCase();
  for (const term of FORBIDDEN) if (low.includes(term)) return term;
  return null;
}

export async function saveReading(row: {
  gameId: string;
  provider: string;
  model: string;
  inputHash: string;
  summary: string;
  cautions: string[];
  tokensIn?: number;
  tokensOut?: number;
}): Promise<CachedReading> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("ai_readings")
    .insert({
      game_id: row.gameId,
      provider: row.provider,
      model: row.model,
      input_hash: row.inputHash,
      summary: row.summary,
      cautions: row.cautions,
      tokens_in: row.tokensIn ?? 0,
      tokens_out: row.tokensOut ?? 0,
    })
    .select("id, game_id, provider, model, created_at, input_hash, summary, cautions")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao salvar leitura");
  return {
    id: data.id,
    gameId: data.game_id,
    provider: data.provider,
    model: data.model,
    createdAt: data.created_at,
    inputHash: data.input_hash,
    summary: data.summary,
    cautions: Array.isArray(data.cautions) ? data.cautions : [],
    ageMin: 0,
    fresh: true,
  };
}

// ----- Prompt e chamada ao provedor -----

const SYSTEM_PROMPT = `Você é um analista esportivo objetivo. Escreva em pt-BR uma leitura curta e responsável a partir apenas dos números fornecidos (odds, referência, edge, dispersão, cobertura). Regras obrigatórias:
- Máximo 120 palavras.
- Nunca use: "aposte", "aposte agora", "palpite", "palpite certeiro", "palpite infalível", "lucro", "lucro certo", "renda", "renda extra", "garantido", "certeza", "infalível", "robô vencedor".
- Não recomende apostar. Não prometa resultados. Não invente estatísticas fora dos números dados.
- Sempre lembre que a decisão final é do usuário e que jogo envolve risco.
- Responda estritamente em JSON no formato: {"summary": string, "cautions": string[] (2 a 4 itens)}.`;

function userPrompt(input: AssistedReadingInput): string {
  return `Dados objetivos do jogo (mercado 1X2, apenas números):\n${JSON.stringify(
    { ...input, constraints: undefined },
    null,
    2,
  )}\n\nGere o JSON conforme instruído.`;
}

interface ProviderCall {
  summary: string;
  cautions: string[];
  tokensIn: number;
  tokensOut: number;
}

export async function callProvider(input: AssistedReadingInput): Promise<ProviderCall> {
  const st = getProviderStatus();
  if (!st.configured) {
    const e = new Error(st.reason ?? "provider_not_configured");
    (e as Error & { code?: string }).code = "provider_not_configured";
    throw e;
  }
  if (st.provider === "lovable") return callOpenAICompatible({
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY! },
    model: st.model!,
    input,
  });
  if (st.provider === "openai") return callOpenAICompatible({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
    model: st.model!,
    input,
  });
  // Anthropic
  return callAnthropic({ model: st.model!, input });
}

async function callOpenAICompatible(opts: {
  url: string;
  headers: Record<string, string>;
  model: string;
  input: AssistedReadingInput;
}): Promise<ProviderCall> {
  const resp = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(opts.input) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Provedor ${resp.status}: ${body.slice(0, 200)}`);
  }
  const j = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  const parsed = safeJson(raw);
  return {
    summary: String(parsed.summary ?? "").trim(),
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(String).slice(0, 4) : [],
    tokensIn: j.usage?.prompt_tokens ?? 0,
    tokensOut: j.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(opts: {
  model: string;
  input: AssistedReadingInput;
}): Promise<ProviderCall> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(opts.input) }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 200)}`);
  }
  const j = (await resp.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const raw = j.content?.find((c) => c.type === "text")?.text ?? "{}";
  const parsed = safeJson(raw);
  return {
    summary: String(parsed.summary ?? "").trim(),
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(String).slice(0, 4) : [],
    tokensIn: j.usage?.input_tokens ?? 0,
    tokensOut: j.usage?.output_tokens ?? 0,
  };
}

function safeJson(text: string): { summary?: unknown; cautions?: unknown } {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}
