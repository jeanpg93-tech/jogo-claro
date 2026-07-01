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

const SYSTEM_PROMPT = `Você é um analista esportivo brasileiro, especialista em futebol e leitura de mercado, do produto "Visão de Jogo". Sua função é traduzir números frios (odds, referência, dispersão) em uma leitura clara e responsável para o usuário adulto. Você NÃO é sistema de sinais, tipster nem robô de apostas.

TOM E LINGUAGEM (obrigatório):
- Português do Brasil, claro, humano e amigável. Nada de tom robótico.
- SEMPRE use: "mandante", "empate", "visitante". NUNCA use "home", "draw", "away".
- Evite jargão técnico sem explicar. Se usar um termo (edge, dispersão, spread), traduza entre parênteses de forma curta (ex.: "edge de 3pp — diferença de 3 pontos percentuais frente à referência").
- Prefira frases curtas. Explique como se estivesse conversando com um adulto inteligente que não é analista.

PROIBIÇÕES (violação = resposta descartada):
- Nunca use: "aposte", "aposte agora", "não aposte", "palpite", "palpite certeiro", "palpite infalível", "lucro", "lucro certo", "renda", "renda extra", "renda garantida", "garantido", "certeza", "infalível", "robô vencedor", "green certo".
- Não diga ao usuário para apostar ou não apostar.
- Não prometa resultado, acerto, ganho ou retorno.
- Diferencie explicitamente: dado disponível, dado ausente e inferência.

CONTEÚDO:
- Baseie-se APENAS nos números objetivos fornecidos. Não invente estatísticas, escalações, clima, histórico ou fontes externas.
- Se a qualidade dos dados for baixa, oriente aguardar.

STATUS (escolha um):
- "sem_cobertura": menos de 2 casas OU sem referência.
- "aguardar_dados": dados desatualizados, dispersos ou incompletos.
- "sem_oportunidade": dados suficientes e sem diferença relevante frente à referência.
- "oportunidade_analitica": dados suficientes E edge relevante (>= ~3pp) em algum lado.

Responda ESTRITAMENTE em JSON válido:
{
  "status": "sem_cobertura"|"aguardar_dados"|"sem_oportunidade"|"oportunidade_analitica",
  "frase_chave": string (1 frase de no máximo 14 palavras, o "título" da análise em linguagem de torcedor),
  "resumo_direto": string (1 frase de no máximo 25 palavras, versão bem simples para quem não quer ler muito),
  "resumo": string (2 a 3 frases, versão completa e um pouco mais técnica, máx 60 palavras),
  "qualidade_dados": string (1 a 2 frases sobre cobertura, referência e frescor, em linguagem simples),
  "leitura_odds": string (1 a 2 frases sobre as odds e diferenças entre casas — sempre diga mandante/empate/visitante),
  "comparacao_referencia": string (1 a 2 frases sobre a diferença frente à referência, ou "sem referência disponível"),
  "riscos": string[] (2 a 4 itens curtos, cada um traduzido em linguagem amigável),
  "pontos_atencao": string[] (2 a 4 itens curtos),
  "perfis": {
    "conservador": string (1 a 2 frases, tom cauteloso),
    "equilibrado": string (1 a 2 frases, tom neutro),
    "agressivo": string (1 a 2 frases, ciente de volatilidade),
    "oportunista": string (1 a 2 frases, foco em diferença vs referência),
    "iniciante": string (1 a 2 frases, tom didático e de disciplina)
  },
  "conclusao": string (1 a 2 frases lembrando que a decisão é do usuário e que jogo envolve risco),
  "aguardar_dados_motivo": string ou null (se status="aguardar_dados"/"sem_cobertura", diga o que falta em linguagem simples)
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

class ProviderHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProviderHttpError";
    this.status = status;
  }
}

const COMPACT_SYSTEM_PROMPT = `Você é um analista esportivo brasileiro do produto "Visão de Jogo". Responda em português do Brasil, claro e responsável. Não dê ordem para apostar ou não apostar. Não prometa resultado, ganho ou acerto. Use sempre "mandante", "empate" e "visitante"; nunca use home, draw ou away.

Use apenas os dados objetivos recebidos. Não invente estatísticas, histórico, escalações, clima ou fontes externas.

Termos proibidos: aposte, aposte agora, não aposte, palpite, palpite certeiro, lucro, renda, garantido, certeza, infalível, robô vencedor, green certo.

Responda somente JSON válido, sem markdown, com estes campos:
{"status":"sem_cobertura|aguardar_dados|sem_oportunidade|oportunidade_analitica","frase_chave":"até 12 palavras","resumo_direto":"até 22 palavras","resumo":"até 45 palavras","qualidade_dados":"até 30 palavras","leitura_odds":"até 35 palavras","comparacao_referencia":"até 35 palavras","riscos":["2 a 3 itens curtos"],"pontos_atencao":["2 a 3 itens curtos"],"perfis":{"conservador":"1 frase","equilibrado":"1 frase","agressivo":"1 frase","oportunista":"1 frase","iniciante":"1 frase"},"conclusao":"até 25 palavras","aguardar_dados_motivo":null ou string}`;

function envMaxTokens(defaultValue: number): number {
  const n = Number(process.env.ASSISTED_AI_MAX_TOKENS ?? defaultValue);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(Math.max(Math.round(n), 700), 2500);
}

function isRetryableProviderError(err: unknown): boolean {
  if (err instanceof ProviderHttpError) return err.status === 429 || err.status >= 500;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /resposta vazia|resposta incompleta|finish_reason=length|unexpected end/i.test(msg);
}

export async function callProvider(input: AssistedReadingInput): Promise<ProviderCall> {
  const st = getProviderStatus();
  if (!st.configured) {
    const e = new Error(st.reason ?? "provider_not_configured");
    (e as Error & { code?: string }).code = "provider_not_configured";
    throw e;
  }
  if (st.provider === "external") {
    const externalOpts = {
      url: `${process.env.AI_GATEWAY_BASE_URL!.replace(/\/$/, "")}/chat/completions`,
      headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY!}` },
      model: st.model!,
      input,
      // Gateway (claude via /v1/chat/completions) não aceita response_format json_object.
      requestJson: false,
    };
    try {
      return await callOpenAICompatible({ ...externalOpts, maxTokens: envMaxTokens(1600) });
    } catch (err) {
      if (!isRetryableProviderError(err)) throw err;
      console.warn(
        "[assisted-reading] provider retrying compact mode:",
        err instanceof Error ? err.message.slice(0, 180) : "unknown",
      );
      return callOpenAICompatible({ ...externalOpts, maxTokens: 1200, compact: true });
    }
  }
  if (st.provider === "lovable")
    return callOpenAICompatible({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY! },
      model: st.model!,
      input,
      requestJson: true,
      maxTokens: envMaxTokens(2200),
    });
  if (st.provider === "openai")
    return callOpenAICompatible({
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
      model: st.model!,
      input,
      requestJson: true,
      maxTokens: envMaxTokens(2200),
    });
  return callAnthropic({ model: st.model!, input });
}

async function callOpenAICompatible(opts: {
  url: string;
  headers: Record<string, string>;
  model: string;
  input: AssistedReadingInput;
  requestJson: boolean;
  maxTokens: number;
  compact?: boolean;
}): Promise<ProviderCall> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.compact ? COMPACT_SYSTEM_PROMPT : SYSTEM_PROMPT },
      { role: "user", content: userPrompt(opts.input) },
    ],
    temperature: 0.3,
    max_tokens: opts.maxTokens,
  };
  if (opts.requestJson) body.response_format = { type: "json_object" };
  const resp = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new ProviderHttpError(resp.status, `Provedor ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await resp.json()) as {
    choices: Array<{ message: { content: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const finishReason = j.choices?.[0]?.finish_reason;
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  if (!raw.trim()) throw new Error("Resposta vazia do provedor");
  const payload = normalizePayload(safeJson(raw));
  if (!payload.resumo && finishReason === "length") {
    throw new Error("Resposta incompleta do provedor (finish_reason=length)");
  }
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
      max_tokens: 2200,
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
    resumo_direto: String(raw.resumo_direto ?? raw.resumo ?? "").trim(),
    frase_chave: String(raw.frase_chave ?? "").trim(),
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
