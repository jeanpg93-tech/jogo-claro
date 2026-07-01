// Fase 5 — Leitura assistida (IA externa opcional).
// - Nunca usa IA nativa do Lovable.
// - Chama /api/assisted-reading com Bearer do usuário.
// - Se o backend responder "not_configured", o shell continua acessível
//   mas o botão fica desabilitado com o motivo.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bot,
  EyeOff,
  ClipboardList,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import type { Game } from "@/lib/demo-games";
import {
  buildAssistedReadingInput,
  type AssistedReadingStatus,
} from "@/lib/assisted-reading";
import { supabase } from "@/integrations/supabase/client";
import { analyzeGame } from "@/lib/game-analysis";

interface CachedReading {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
  summary: string;
  cautions: string[];
  ageMin: number;
  fresh: boolean;
}

interface ApiResponse {
  status: "ready" | "not_configured" | "blocked" | "error";
  reading?: CachedReading;
  fromCache?: boolean;
  provider?: string;
  message?: string;
}

export function AssistedReadingSection({ game }: { game: Game }) {
  const input = buildAssistedReadingInput(game);
  const analysis = analyzeGame(game);
  const dataOk = analysis.coverage.hasReference && analysis.coverage.totalBooks >= 3;

  const [reading, setReading] = useState<CachedReading | null>(null);
  const [status, setStatus] = useState<AssistedReadingStatus>(
    dataOk ? "empty" : "insufficient_data",
  );
  const [providerMsg, setProviderMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<ApiResponse> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Faça login para gerar a leitura.");
      const resp = await fetch("/api/assisted-reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameId: game.id, input }),
      });
      const json = (await resp.json().catch(() => ({}))) as ApiResponse;
      return json;
    },
    onMutate: () => setStatus("loading"),
    onSuccess: (json) => {
      if (json.status === "ready" && json.reading) {
        setReading(json.reading);
        setStatus("ready");
        setProviderMsg(null);
      } else if (json.status === "not_configured") {
        setStatus("not_configured");
        setProviderMsg(json.message ?? "Provedor de IA não configurado.");
      } else if (json.status === "blocked") {
        setStatus("blocked");
        setProviderMsg(json.message ?? "Saída rejeitada.");
      } else {
        setStatus("error");
        setProviderMsg(json.message ?? "Falha desconhecida.");
      }
    },
    onError: (err) => {
      setStatus("error");
      setProviderMsg(err instanceof Error ? err.message : "Erro de rede.");
    },
  });

  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const canGenerate = dataOk && status !== "loading";

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Bot className="h-3.5 w-3.5" /> Leitura assistida
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            IA externa · resumo objetivo sob demanda
          </h2>
        </div>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
          Fase 5 · opcional
        </span>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Gera, sob demanda, um resumo curto em pt-BR a partir apenas dos números
        objetivos deste jogo (odds, referência, edge, dispersão). O texto é
        filtrado contra termos proibidos antes de ser exibido. Cache de 30 min.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {reading ? "Regenerar leitura" : "Gerar leitura"}
        </button>
        {reading && (
          <span className="text-[11px] text-muted-foreground">
            Gerada há {reading.ageMin} min · provedor{" "}
            <b>{reading.provider}</b>
            {reading.model ? ` · ${reading.model}` : ""}
          </span>
        )}
      </div>

      {reading && status === "ready" && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm leading-relaxed text-foreground">
            {reading.summary}
          </p>
          {reading.cautions.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-emerald-100/90">
              {reading.cautions.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 flex-none opacity-70" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            A decisão final é sua. Jogo envolve risco.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className={`rounded-xl border p-4 ${meta.tone}`}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
            <Icon className="h-3.5 w-3.5" /> Estado atual
          </div>
          <div className="mt-1 text-base font-semibold">{meta.label}</div>
          <p className="mt-1 text-sm opacity-90">{meta.description}</p>
          {providerMsg && (
            <p className="mt-2 text-[11px] opacity-80">
              <b>Detalhe:</b> {providerMsg}
            </p>
          )}
        </div>
        <ContractCard input={input} />
      </div>

      <ul className="mt-4 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
        <li>· Nunca usa a IA nativa do Lovable.</li>
        <li>· Chave do provedor fica em Secret server-side.</li>
        <li>· Saída proibida: "aposte", "palpite", "lucro", "garantido".</li>
        <li>· Cache de 30 min por jogo — regenera se odds mudarem.</li>
      </ul>
    </section>
  );
}

function ContractCard({
  input,
}: {
  input: ReturnType<typeof buildAssistedReadingInput>;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" /> O que a IA externa recebe
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          Cobertura: <b>{input.coverage.totalBooks}</b> casas · referência{" "}
          <b>{input.coverage.hasReference ? "sim" : "não"}</b> · frescor{" "}
          <b>{input.coverage.fresh ? "ok" : "fora"}</b>.
        </li>
        <li>Consenso por lado (média, referência, edge, dispersão).</li>
        <li>
          Idioma exigido: <b>pt-BR</b>, até <b>{input.constraints.maxWords}</b>{" "}
          palavras.
        </li>
        <li>Termos proibidos e cláusulas obrigatórias explícitas no prompt.</li>
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
          Ver payload completo (debug)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background/60 p-2 text-[10px] leading-tight">
{JSON.stringify(input, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const STATUS_META: Record<
  AssistedReadingStatus,
  { label: string; description: string; tone: string; icon: typeof Bot }
> = {
  disabled: {
    label: "Desativada",
    description: "A leitura assistida está desligada nesta instalação.",
    tone: "border-muted bg-muted/20 text-foreground",
    icon: EyeOff,
  },
  not_configured: {
    label: "Provedor não configurado",
    description:
      "Defina ASSISTED_AI_PROVIDER e a chave correspondente em Secrets server-side para habilitar.",
    tone: "border-muted bg-muted/20 text-foreground",
    icon: EyeOff,
  },
  insufficient_data: {
    label: "Dados objetivos insuficientes",
    description:
      "É necessário ter referência de mercado e pelo menos 3 casas para permitir uma leitura assistida.",
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-100",
    icon: AlertTriangle,
  },
  empty: {
    label: "Ainda não gerada",
    description:
      "Clique em Gerar leitura para produzir um resumo objetivo sob demanda.",
    tone: "border-border/60 bg-background/30 text-foreground",
    icon: ClipboardList,
  },
  loading: {
    label: "Gerando…",
    description: "Consultando o provedor externo com o payload objetivo.",
    tone: "border-border/60 bg-background/30 text-foreground",
    icon: Loader2,
  },
  ready: {
    label: "Leitura disponível",
    description:
      "Resumo objetivo gerado a partir dos números. Cache de 30 min por jogo.",
    tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-100",
    icon: Bot,
  },
  stale: {
    label: "Leitura desatualizada",
    description:
      "Os dados de odds mudaram desde a última geração. Regenere quando quiser.",
    tone: "border-yellow-500/40 bg-yellow-500/5 text-yellow-100",
    icon: AlertTriangle,
  },
  blocked: {
    label: "Saída rejeitada",
    description:
      "A resposta do provedor continha termo proibido e foi descartada. Tente novamente.",
    tone: "border-red-500/40 bg-red-500/5 text-red-100",
    icon: ShieldAlert,
  },
  error: {
    label: "Provedor externo indisponível",
    description:
      "A última tentativa falhou. Tente novamente mais tarde. Nenhum dado sensível é enviado.",
    tone: "border-red-500/40 bg-red-500/5 text-red-100",
    icon: AlertTriangle,
  },
};
