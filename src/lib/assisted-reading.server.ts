// Fase 6 — Backend da "Análise assistida por jogo".
// Executa apenas no servidor. Nunca importe este arquivo do cliente.
//
// Regras firmes:
// - Não usa IA nativa do Lovable no produto final. O provedor é externo,
//   configurado por ASSISTED_AI_PROVIDER=external + AI_GATEWAY_BASE_URL +
//   AI_GATEWAY_MODEL + AI_GATEWAY_API_KEY (server-side).
// - Cache por jogo com TTL de 30 min. Se o input_hash mudar (odds mudaram)
//   uma nova geração é permitida.
// - Cotas diárias por instalação (ASSISTED_AI_DAILY_LIMIT).
// - Sanitiza a saída contra termos proibidos antes de persistir.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { AssistedReadingInput, AssistedReadingPayload } from "./assisted-reading";

export const CACHE_TTL_MIN = 30;

const FORBIDDEN = [
  "aposte agora",
  "aposte",
  "não aposte",
  "nao aposte",
  "palpite certeiro",
  "palpite infal",
  "palpite",
  "lucro certo",
  "lucro",
  "renda extra",
  "renda garantida",
  "garantido",
  "certeza",
  "infalível",
  "infalivel",
  "robô vencedor",
  "robo vencedor",
  "green certo",
];

export type ProviderId = "" | "external" | "lovable" | "openai" | "anthropic";

export interface ProviderStatus {
  provider: ProviderId;
  configured: boolean;
  model: string | null;
  reason?: string;
}

export function getProviderStatus(): ProviderStatus {
  const raw = (process.env.ASSISTED_AI_PROVIDER ?? "").trim().toLowerCase();
  let provider = (["external", "lovable", "openai", "anthropic"].includes(raw)
    ? raw
    : "") as ProviderId;
  // Auto-detect: se as envs do gateway externo estão presentes, assume "external".
  if (!provider && process.env.AI_GATEWAY_BASE_URL && process.env.AI_GATEWAY_API_KEY) {
    provider = "external";
  }
  if (!provider) {
    return { provider: "", configured: false, model: null, reason: "ASSISTED_AI_PROVIDER não definido" };
  }
  if (provider === "external") {
    const url = process.env.AI_GATEWAY_BASE_URL;
    const key = process.env.AI_GATEWAY_API_KEY;
    const model = process.env.AI_GATEWAY_MODEL ?? "claude-sonnet-4-6";
    if (!url || !key) {
      return {
        provider,
        configured: false,
        model,
        reason: !url ? "AI_GATEWAY_BASE_URL ausente" : "AI_GATEWAY_API_KEY ausente",
      };
    }
    return { provider, configured: true, model };
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
  // Ignora updatedAtISO no hash — só invalida quando o conteúdo muda.
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
  status: AssistedReadingPayload["status"];
  payload: AssistedReadingPayload;
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
    .select("id, game_id, provider, model, created_at, input_hash, status, payload")
    .eq("game_id", gameId)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.payload) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  const ageMin = Math.round(ageMs / 60000);
  return {
    id: data.id,
    gameId: data.game_id,
    provider: data.provider,
    model: data.model,
    createdAt: data.created_at,
    inputHash: data.input_hash,
    status: (data.status ?? data.payload?.status ?? "aguardar_dados") as AssistedReadingPayload["status"],
    payload: data.payload as AssistedReadingPayload,
    ageMin,
    fresh: ageMin < CACHE_TTL_MIN,
  };
}

export async function readLatestReading(gameId: string): Promise<CachedReading | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("ai_readings")
    .select("id, game_id, provider, model, created_at, input_hash, status, payload")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.payload) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  const ageMin = Math.round(ageMs / 60000);
  return {
    id: data.id,
    gameId: data.game_id,
    provider: data.provider,
    model: data.model,
    createdAt: data.created_at,
    inputHash: data.input_hash,
    status: (data.status ?? data.payload?.status ?? "aguardar_dados") as AssistedReadingPayload["status"],
    payload: data.payload as AssistedReadingPayload,
    ageMin,
    fresh: ageMin < CACHE_TTL_MIN,
  };
}

export function containsForbidden(payload: AssistedReadingPayload): string | null {
  const flat = JSON.stringify(payload).toLowerCase();
  for (const term of FORBIDDEN) if (flat.includes(term)) return term;
  return null;
}

// ----- Quota diária -----

export async function checkAndIncrementQuota(): Promise<{
  ok: boolean;
  used: number;
  limit: number;
}> {
  const limit = Number(process.env.ASSISTED_AI_DAILY_LIMIT ?? "200");
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true, used: 0, limit: 0 };
  const admin = getAdmin();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("ai_readings_quota")
    .select("count")
    .eq("day", day)
    .maybeSingle();
  const used = data?.count ?? 0;
  if (used >= limit) return { ok: false, used, limit };
  await admin
    .from("ai_readings_quota")
    .upsert({ day, count: used + 1 }, { onConflict: "day" });
  return { ok: true, used: used + 1, limit };
}

export async function saveReading(row: {
  gameId: string;
  provider: string;
  model: string;
  inputHash: string;
  status: AssistedReadingPayload["status"];
  payload: AssistedReadingPayload;
  tokensIn?: number;
  tokensOut?: number;
  error?: string | null;
}): Promise<CachedReading> {
  const admin = getAdmin();
  // Mantém colunas legadas summary/cautions preenchidas por compatibilidade.
  const summary = row.payload.resumo ?? "";
  const cautions = row.payload.pontos_atencao ?? [];
  const { data, error } = await admin
    .from("ai_readings")
    .insert({
      game_id: row.gameId,
      provider: row.provider,
      model: row.model,
      input_hash: row.inputHash,
      status: row.status,
      payload: row.payload,
      summary,
      cautions,
      tokens_in: row.tokensIn ?? 0,
      tokens_out: row.tokensOut ?? 0,
      error: row.error ?? null,
    })
    .select("id, game_id, provider, model, created_at, input_hash, status, payload")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao salvar leitura");
  return {
    id: data.id,
    gameId: data.game_id,
    provider: data.provider,
    model: data.model,
    createdAt: data.created_at,
    inputHash: data.input_hash,
    status: (data.status ?? data.payload?.status ?? row.status) as AssistedReadingPayload["status"],
    payload: data.payload as AssistedReadingPayload,
    ageMin: 0,
    fresh: true,
  };
}

// ----- Prompt e chamada ao provedor -----

const SYSTEM_PROMPT = `Você é um analista esportivo objetivo do produto "Visão de Jogo". Sua função é organizar dados, riscos e contexto para apoiar a decisão do usuário adulto. Você NÃO é um sistema de sinais, robô de apostas ou tipster.

REGRAS OBRIGATÓRIAS de linguagem (violação = resposta descartada):
- Nunca use: "aposte", "aposte agora", "não aposte", "palpite", "palpite certeiro", "palpite infalível", "lucro", "lucro certo", "renda", "renda extra", "renda garantida", "garantido", "certeza", "infalível", "robô vencedor", "green certo".
- Não diga ao usuário para apostar ou não apostar em nada.
- Não prometa resultado, acerto, ganho ou retorno.
- Use linguagem de análise, risco, disciplina e decisão do usuário.
- Diferencie explicitamente: dado disponível, dado ausente e inferência.
- Se a qualidade dos dados for baixa, recomende aguardar dados.

REGRAS DE CONTEÚDO:
- Baseie-se APENAS nos números objetivos fornecidos (odds, referência, edge, dispersão, cobertura). Não invente estatísticas, escalações, clima, histórico ou fontes.
- Português do Brasil. Cada campo curto e direto.

STATUS obrigatório (escolha um):
- "sem_cobertura": cobertura muito baixa (menos de 2 casas OU sem referência).
- "aguardar_dados": há dados mas estão desatualizados, muito dispersos ou incompletos.
- "sem_oportunidade": dados suficientes e sem diferença relevante frente à referência (edge pequeno em todos os lados).
- "oportunidade_analitica": dados suficientes E há edge relevante (>= ~3pp) em algum lado.

Responda ESTRITAMENTE em JSON válido, no formato:
{
  "status": "sem_cobertura"|"aguardar_dados"|"sem_oportunidade"|"oportunidade_analitica",
  "resumo": string (2 a 3 frases, máx 60 palavras),
  "qualidade_dados": string (1 a 2 frases sobre cobertura, referência e frescor),
  "leitura_odds": string (1 a 2 frases sobre odds e dispersão entre casas),
  "comparacao_referencia": string (1 a 2 frases sobre edge vs referência ou "sem referência disponível"),
  "riscos": string[] (2 a 4 itens objetivos),
  "pontos_atencao": string[] (2 a 4 itens objetivos),
  "perfis": {
    "conservador": string (1 a 2 frases, tom cauteloso),
    "equilibrado": string (1 a 2 frases, tom neutro),
    "agressivo": string (1 a 2 frases, ciente de volatilidade),
    "oportunista": string (1 a 2 frases, foco em edge vs referência),
    "iniciante": string (1 a 2 frases, tom didático e de disciplina)
  },
  "conclusao": string (1 a 2 frases, sempre lembrando que a decisão é do usuário e que jogo envolve risco),
  "aguardar_dados_motivo": string ou null (se status="aguardar_dados" ou "sem_cobertura", diga o que falta)
}`;

function userPrompt(input: AssistedReadingInput): string {
  return `Dados objetivos do jogo (mercado 1X2, apenas números):\n${JSON.stringify(
    { ...input, constraints: undefined },
    null,
    2,
  )}\n\nGere o JSON conforme instruído.`;
}

interface ProviderCall {
  payload: AssistedReadingPayload;
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
  if (st.provider === "external") {
    return callOpenAICompatible({
      url: `${process.env.AI_GATEWAY_BASE_URL!.replace(/\/$/, "")}/chat/completions`,
      headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY!}` },
      model: st.model!,
      input,
      requestJson: true,
    });
  }
  if (st.provider === "lovable")
    return callOpenAICompatible({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY! },
      model: st.model!,
      input,
      requestJson: true,
    });
  if (st.provider === "openai")
    return callOpenAICompatible({
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
      model: st.model!,
      input,
      requestJson: true,
    });
  return callAnthropic({ model: st.model!, input });
}

async function callOpenAICompatible(opts: {
  url: string;
  headers: Record<string, string>;
  model: string;
  input: AssistedReadingInput;
  requestJson: boolean;
}): Promise<ProviderCall> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(opts.input) },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  };
  if (opts.requestJson) body.response_format = { type: "json_object" };
  const resp = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Provedor ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  const payload = normalizePayload(safeJson(raw));
  return {
    payload,
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
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(opts.input) }],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Anthropic ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await resp.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const raw = j.content?.find((c) => c.type === "text")?.text ?? "{}";
  const payload = normalizePayload(safeJson(raw));
  return {
    payload,
    tokensIn: j.usage?.input_tokens ?? 0,
    tokensOut: j.usage?.output_tokens ?? 0,
  };
}

function safeJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function normalizePayload(raw: Record<string, unknown>): AssistedReadingPayload {
  const perfis = (raw.perfis ?? {}) as Record<string, unknown>;
  const status = String(raw.status ?? "aguardar_dados") as AssistedReadingPayload["status"];
  const validStatus: AssistedReadingPayload["status"][] = [
    "sem_cobertura",
    "aguardar_dados",
    "sem_oportunidade",
    "oportunidade_analitica",
  ];
  return {
    status: validStatus.includes(status) ? status : "aguardar_dados",
    resumo: String(raw.resumo ?? "").trim(),
    qualidade_dados: String(raw.qualidade_dados ?? "").trim(),
    leitura_odds: String(raw.leitura_odds ?? "").trim(),
    comparacao_referencia: String(raw.comparacao_referencia ?? "").trim(),
    riscos: toStrArr(raw.riscos),
    pontos_atencao: toStrArr(raw.pontos_atencao),
    perfis: {
      conservador: String(perfis.conservador ?? "").trim(),
      equilibrado: String(perfis.equilibrado ?? "").trim(),
      agressivo: String(perfis.agressivo ?? "").trim(),
      oportunista: String(perfis.oportunista ?? "").trim(),
      iniciante: String(perfis.iniciante ?? "").trim(),
    },
    conclusao: String(raw.conclusao ?? "").trim(),
    aguardar_dados_motivo:
      raw.aguardar_dados_motivo == null
        ? null
        : String(raw.aguardar_dados_motivo).trim() || null,
  };
}

function toStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
}
