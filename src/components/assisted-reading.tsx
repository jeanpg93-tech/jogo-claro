// Fase 6 — Análise Assistida (uma por jogo, cacheada, IA externa).
// - Não chama IA nativa do Lovable.
// - Faz GET /api/assisted-reading?gameId=... para carregar a análise salva.
// - POST /api/assisted-reading para gerar quando não há cache válido.
// - Destaca o bloco compatível com o perfil do usuário logado.

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bot,
  EyeOff,
  ClipboardList,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldAlert,
  RefreshCcw,
  Timer,
  Database,
  Scale,
  Gauge,
  CheckCircle2,
  Ban,
} from "lucide-react";
import type { Game } from "@/lib/demo-games";
import {
  buildAssistedReadingInput,
  type AssistedReadingPayload,
  type AssistedReadingUiStatus,
  type AssistedStatus,
  type PerfilKey,
} from "@/lib/assisted-reading";
import { supabase } from "@/integrations/supabase/client";
import { analyzeGame } from "@/lib/game-analysis";
import { useAnalyticalProfile } from "@/hooks/use-analytical-profile";

interface CachedReading {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
  status: AssistedStatus;
  payload: AssistedReadingPayload;
  ageMin: number;
  fresh: boolean;
}

interface HealthInfo {
  degraded: boolean;
  consecutiveFailures: number;
  lastFailureAt: string | null;
  lastFailureMsg: string | null;
  lastSuccessAt: string | null;
  cooldownUntil: string | null;
}

interface ApiResponse {
  status: AssistedReadingUiStatus | "ready" | "not_configured" | "blocked" | "error" | "quota_exceeded";
  reading?: CachedReading | null;
  fromCache?: boolean;
  provider?: string;
  message?: string;
  health?: HealthInfo;
}

const STATUS_LABEL: Record<AssistedStatus, { label: string; tone: string; icon: typeof Bot }> = {
  sem_cobertura: { label: "Sem cobertura", tone: "border-muted bg-muted/20 text-foreground", icon: Ban },
  aguardar_dados: {
    label: "Aguardar dados",
    tone: "border-amber-500/40 bg-amber-500/5 text-amber-100",
    icon: Timer,
  },
  sem_oportunidade: {
    label: "Sem oportunidade",
    tone: "border-slate-500/40 bg-slate-500/5 text-slate-100",
    icon: Gauge,
  },
  oportunidade_analitica: {
    label: "Oportunidade analítica",
    tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-100",
    icon: CheckCircle2,
  },
};

export function AssistedReadingSection({ game }: { game: Game }) {
  const input = buildAssistedReadingInput(game);
  const analysis = analyzeGame(game);
  const dataOk = analysis.coverage.hasReference && analysis.coverage.totalBooks >= 2;
  const { profile } = useAnalyticalProfile();

  const userPerfil = useMemo<PerfilKey>(() => {
    if (profile.experience_level === "iniciante") return "iniciante";
    if (profile.risk_profile === "conservador") return "conservador";
    if (profile.risk_profile === "agressivo") return "agressivo";
    if (profile.risk_profile === "oportunista") return "oportunista";
    return "equilibrado";
  }, [profile]);

  const [reading, setReading] = useState<CachedReading | null>(null);
  const [uiStatus, setUiStatus] = useState<AssistedReadingUiStatus>(
    dataOk ? "empty" : "insufficient_data",
  );
  const [providerMsg, setProviderMsg] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>("");

  // Carrega leitura já salva no banco (uma por jogo, compartilhada).
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const resp = await fetch(`/api/assisted-reading?gameId=${encodeURIComponent(game.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await resp.json().catch(() => ({}))) as {
          provider?: { provider: string; configured: boolean; reason?: string };
          reading?: CachedReading | null;
        };
        if (cancel) return;
        if (json.provider) {
          setProviderName(json.provider.provider || "");
          if (!json.provider.configured) {
            setProviderMsg(json.provider.reason ?? "Provedor de IA não configurado.");
          }
        }
        if (json.reading) {
          setReading(json.reading);
          setUiStatus("ready");
        }
      } catch {
        /* silencioso: shell continua acessível */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [game.id]);

  const mutation = useMutation({
    mutationFn: async (opts: { force?: boolean }): Promise<ApiResponse> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Faça login para gerar a análise.");
      const url = opts.force
        ? "/api/assisted-reading?force=1"
        : "/api/assisted-reading";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId: game.id, input }),
      });
      return (await resp.json().catch(() => ({}))) as ApiResponse;
    },
    onMutate: () => setUiStatus("loading"),
    onSuccess: (json) => {
      if ((json.status === "ready") && json.reading) {
        setReading(json.reading);
        setUiStatus("ready");
        setProviderMsg(null);
      } else if (json.status === "not_configured") {
        setUiStatus("not_configured");
        setProviderMsg(json.message ?? "Provedor de IA não configurado.");
        if (json.reading) setReading(json.reading);
      } else if (json.status === "quota_exceeded") {
        setUiStatus("quota_exceeded");
        setProviderMsg(json.message ?? "Limite diário atingido.");
        if (json.reading) setReading(json.reading);
      } else if (json.status === "blocked") {
        setUiStatus("blocked");
        setProviderMsg(json.message ?? "Saída rejeitada.");
      } else {
        setUiStatus("error");
        setProviderMsg(json.message ?? "Falha desconhecida.");
        if (json.reading) setReading(json.reading);
      }
    },
    onError: (err) => {
      setUiStatus("error");
      setProviderMsg(err instanceof Error ? err.message : "Erro de rede.");
    },
  });

  const canGenerate = dataOk && uiStatus !== "loading";
  const hasReading = Boolean(reading);
  const [mode, setMode] = useState<"direta" | "detalhada">("direta");

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Bot className="h-3.5 w-3.5" /> Análise com IA
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Uma leitura por partida, compartilhada
          </h2>
        </div>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
          Beta
        </span>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Uma análise única por jogo, gerada por IA e reaproveitada para todos os
        usuários. A leitura por perfil abaixo é apenas um recorte — a decisão
        final é sempre sua. Atualizada a cada 30 minutos.
      </p>

      {/* Modo Direta / Detalhada */}
      {hasReading && (
        <div className="mt-4 inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("direta")}
            className={
              "rounded-md px-3 py-1.5 font-medium transition " +
              (mode === "direta"
                ? "bg-emerald-500/20 text-emerald-100"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Direta
          </button>
          <button
            type="button"
            onClick={() => setMode("detalhada")}
            className={
              "rounded-md px-3 py-1.5 font-medium transition " +
              (mode === "detalhada"
                ? "bg-emerald-500/20 text-emerald-100"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Detalhada
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate({ force: false })}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uiStatus === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {hasReading ? "Atualizar análise" : "Gerar análise"}
        </button>
        {hasReading && (
          <button
            type="button"
            onClick={() => mutation.mutate({ force: true })}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            title="Força uma nova geração (respeita a cota diária)"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Regenerar
          </button>
        )}
        {reading && (
          <span className="text-[11px] text-muted-foreground">
            Atualizada há <b>{reading.ageMin} min</b>
          </span>
        )}
      </div>

      {/* Skeleton de carregamento */}
      {uiStatus === "loading" && <LoadingSkeleton />}

      {/* Estado inline / erros */}
      {uiStatus !== "ready" && uiStatus !== "loading" && (
        <InlineState status={uiStatus} message={providerMsg} dataOk={dataOk} />
      )}

      {/* Leitura */}
      {reading && uiStatus !== "loading" && (
        <ReadingBody reading={reading} userPerfil={userPerfil} mode={mode} />
      )}

      {!reading && uiStatus === "empty" && (
        <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
          Análise ainda não gerada para este jogo. Clique em <b>Gerar análise</b>{" "}
          para produzir a leitura compartilhada.
        </div>
      )}

      <ul className="mt-4 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
        <li>· A análise roda apenas no servidor, com dados objetivos do jogo.</li>
        <li>· Cache por partida — todos os usuários leem a mesma leitura base.</li>
        <li>· Saída filtrada contra termos como "aposte", "palpite", "lucro".</li>
        <li>· A decisão final é sua. Jogo envolve risco.</li>
      </ul>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-5 space-y-3">
      <div className="h-20 animate-pulse rounded-xl border border-border/60 bg-gradient-to-r from-background/30 via-muted/20 to-background/30" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/10" style={{ animationDelay: "80ms" }} />
        <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/10" style={{ animationDelay: "160ms" }} />
        <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/10" style={{ animationDelay: "240ms" }} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
        Lendo os dados do jogo e montando a análise…
      </div>
    </div>
  );
}

function ReadingBody({
  reading,
  userPerfil,
  mode,
}: {
  reading: CachedReading;
  userPerfil: PerfilKey;
  mode: "direta" | "detalhada";
}) {
  const p = reading.payload;
  const statusMeta = STATUS_LABEL[p.status];
  const StatusIcon = statusMeta.icon;
  const isDireta = mode === "direta";

  return (
    <div className="mt-5 space-y-4">
      {/* Frase-chave */}
      {p.frase_chave && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
            Em uma frase
          </div>
          <p className="mt-1 text-base font-medium leading-snug">{p.frase_chave}</p>
        </div>
      )}

      {/* Status + resumo (curto na Direta, completo na Detalhada) */}
      <div className={`rounded-xl border p-4 ${statusMeta.tone}`}>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
          <StatusIcon className="h-3.5 w-3.5" /> Status da análise
        </div>
        <div className="mt-1 text-lg font-semibold">{statusMeta.label}</div>
        {(isDireta ? p.resumo_direto || p.resumo : p.resumo) && (
          <p className="mt-2 text-sm leading-relaxed">
            {isDireta ? p.resumo_direto || p.resumo : p.resumo}
          </p>
        )}
        {p.aguardar_dados_motivo && (
          <p className="mt-2 text-[12px] opacity-80">
            <b>O que falta:</b> {p.aguardar_dados_motivo}
          </p>
        )}
      </div>

      {/* Direta: por que é favorito + odd de referência */}
      {isDireta && (p.por_que_favorito || p.odd_referencia_justa?.valor) && (
        <div className="grid gap-3 md:grid-cols-2">
          {p.por_que_favorito && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" /> Por que é o favorito
              </div>
              <p className="mt-2 text-sm leading-relaxed">{p.por_que_favorito}</p>
            </div>
          )}
          {p.odd_referencia_justa?.valor && p.odd_referencia_justa.lado && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-sky-200">
                <Scale className="h-3.5 w-3.5" /> Odd de referência analítica
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-sky-100">
                  {p.odd_referencia_justa.valor.toFixed(2)}
                </span>
                <span className="text-xs uppercase tracking-wider text-sky-200/80">
                  {p.odd_referencia_justa.lado}
                </span>
              </div>
              {p.odd_referencia_justa.comentario && (
                <p className="mt-2 text-[12px] leading-relaxed opacity-90">
                  {p.odd_referencia_justa.comentario}
                </p>
              )}
              <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Referência analítica — não é sugestão de aposta.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Blocos analíticos — só na Detalhada */}
      {!isDireta && (
        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard icon={Database} title="Qualidade dos dados" text={p.qualidade_dados} />
          <InfoCard icon={Gauge} title="Leitura das odds" text={p.leitura_odds} />
          <InfoCard icon={Scale} title="Comparação com referência" text={p.comparacao_referencia} />
        </div>
      )}

      {/* Riscos + atenção */}
      <div className="grid gap-3 md:grid-cols-2">
        <ListCard icon={AlertTriangle} title="Principais riscos" items={p.riscos} tone="amber" />
        <ListCard icon={ShieldAlert} title="Pontos de atenção" items={p.pontos_atencao} tone="slate" />
      </div>

      {/* Leitura por perfil */}
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Leitura por perfil
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
            Seu perfil: {PERFIL_LABEL[userPerfil]}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {(Object.keys(PERFIL_LABEL) as PerfilKey[]).map((k) => {
            const isMine = k === userPerfil;
            return (
              <div
                key={k}
                className={
                  "rounded-lg border p-3 text-sm " +
                  (isMine
                    ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                    : "border-border/50 bg-background/40 text-muted-foreground")
                }
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                  {PERFIL_LABEL[k]}
                  {isMine && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200">
                      recomendado para você
                    </span>
                  )}
                </div>
                <p className="mt-1 leading-relaxed">{p.perfis[k] || "—"}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conclusão */}
      {p.conclusao && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Conclusão responsável
          </div>
          <p className="mt-2 text-sm leading-relaxed">{p.conclusao}</p>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            A decisão final é sua. Jogo envolve risco.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof Bot; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{text || "—"}</p>
    </div>
  );
}

function ListCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof Bot;
  title: string;
  items: string[];
  tone: "amber" | "slate";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
      : "border-slate-500/30 bg-slate-500/5 text-slate-100";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-[13px]">
          {items.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-60">·</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] opacity-80">—</p>
      )}
    </div>
  );
}

function InlineState({
  status,
  message,
  dataOk,
}: {
  status: AssistedReadingUiStatus;
  message: string | null;
  dataOk: boolean;
}) {
  const meta = UI_STATUS_META[status];
  if (!meta) return null;
  if (status === "empty" && dataOk) return null;
  const Icon = meta.icon;
  return (
    <div className={`mt-4 rounded-xl border p-4 ${meta.tone}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </div>
      <p className="mt-1 text-sm opacity-90">{meta.description}</p>
      {message && (
        <p className="mt-2 text-[11px] opacity-80">
          <b>Detalhe:</b> {message}
        </p>
      )}
    </div>
  );
}

const PERFIL_LABEL: Record<PerfilKey, string> = {
  conservador: "Conservador",
  equilibrado: "Equilibrado",
  agressivo: "Agressivo",
  oportunista: "Oportunista",
  iniciante: "Iniciante / disciplinado",
};

const UI_STATUS_META: Partial<
  Record<AssistedReadingUiStatus, { label: string; description: string; tone: string; icon: typeof Bot }>
> = {
  disabled: {
    label: "Desativada",
    description: "A análise assistida está desligada nesta instalação.",
    tone: "border-muted bg-muted/20 text-foreground",
    icon: EyeOff,
  },
  not_configured: {
    label: "Provedor de IA não configurado",
    description:
      "Defina AI_GATEWAY_BASE_URL, AI_GATEWAY_API_KEY e AI_GATEWAY_MODEL em Secrets server-side para habilitar.",
    tone: "border-muted bg-muted/20 text-foreground",
    icon: EyeOff,
  },
  insufficient_data: {
    label: "Dados objetivos insuficientes",
    description:
      "É necessário ter referência de mercado e pelo menos 2 casas para permitir uma análise assistida.",
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-100",
    icon: AlertTriangle,
  },
  loading: {
    label: "Gerando análise…",
    description: "Consultando o provedor externo com os dados objetivos deste jogo.",
    tone: "border-border/60 bg-background/30 text-foreground",
    icon: Loader2,
  },
  stale: {
    label: "Análise desatualizada",
    description:
      "As odds mudaram desde a última geração. Você pode atualizar quando quiser.",
    tone: "border-yellow-500/40 bg-yellow-500/5 text-yellow-100",
    icon: AlertTriangle,
  },
  blocked: {
    label: "Saída rejeitada",
    description:
      "A resposta do provedor continha termo proibido e foi descartada. Tente regenerar.",
    tone: "border-red-500/40 bg-red-500/5 text-red-100",
    icon: ShieldAlert,
  },
  quota_exceeded: {
    label: "Limite diário atingido",
    description:
      "A cota diária de análises foi atingida. Novas gerações voltam a funcionar amanhã.",
    tone: "border-amber-500/40 bg-amber-500/5 text-amber-100",
    icon: Timer,
  },
  error: {
    label: "Análise indisponível no momento",
    description:
      "A última tentativa falhou. Tente novamente mais tarde. Nenhum dado sensível é enviado.",
    tone: "border-red-500/40 bg-red-500/5 text-red-100",
    icon: AlertTriangle,
  },
};
