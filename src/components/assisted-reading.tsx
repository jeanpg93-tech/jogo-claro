// Fase 4 — Shell visual da "Leitura assistida".
// Nunca chama IA. Renderiza estados vazios/desligados e um contrato visível
// do que a IA externa receberá quando a Fase 5 for ativada.

import { Bot, EyeOff, ClipboardList, AlertTriangle } from "lucide-react";
import type { Game } from "@/lib/demo-games";
import {
  ASSISTED_READING_ENABLED,
  buildAssistedReadingInput,
  computeAssistedStatus,
} from "@/lib/assisted-reading";

export function AssistedReadingSection({ game }: { game: Game }) {
  const status = computeAssistedStatus(game);
  const input = buildAssistedReadingInput(game);

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Bot className="h-3.5 w-3.5" /> Leitura assistida
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            IA externa · desativada nesta fase
          </h2>
        </div>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
          Fase 4 · shell
        </span>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Este módulo receberá, em fase futura, um resumo objetivo gerado por uma
        IA externa (fora do Lovable) a partir apenas dos dados de odds e
        referência. Nenhuma chamada é feita agora e nenhum texto é gerado.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <StatusCard status={status} />
        <ContractCard input={input} />
      </div>

      <ul className="mt-4 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
        <li>· Nunca usa a IA nativa do Lovable.</li>
        <li>· Chave do provedor fica em Secret server-side.</li>
        <li>· Saída proibida: "aposte", "palpite", "lucro", "garantido".</li>
        <li>· Sempre marca que a decisão final é do usuário.</li>
      </ul>
    </section>
  );
}

function StatusCard({
  status,
}: {
  status: ReturnType<typeof computeAssistedStatus>;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border p-4 ${meta.tone}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
        <Icon className="h-3.5 w-3.5" /> Estado atual
      </div>
      <div className="mt-1 text-base font-semibold">{meta.label}</div>
      <p className="mt-1 text-sm opacity-90">{meta.description}</p>
      {!ASSISTED_READING_ENABLED && (
        <p className="mt-2 text-[11px] opacity-70">
          Feature flag <code>ASSISTED_READING_ENABLED</code> = <b>false</b>.
        </p>
      )}
    </div>
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
        <ClipboardList className="h-3.5 w-3.5" /> O que a IA externa receberá
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        <li>Cobertura: <b>{input.coverage.totalBooks}</b> casas · referência{" "}
          <b>{input.coverage.hasReference ? "sim" : "não"}</b>{" "}
          · frescor <b>{input.coverage.fresh ? "ok" : "fora"}</b>.
        </li>
        <li>Consenso por lado (média, referência, edge, dispersão).</li>
        <li>Idioma exigido: <b>pt-BR</b>, até <b>{input.constraints.maxWords}</b> palavras.</li>
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
  ReturnType<typeof computeAssistedStatus>,
  {
    label: string;
    description: string;
    tone: string;
    icon: typeof Bot;
  }
> = {
  disabled: {
    label: "Desativada nesta fase",
    description:
      "A leitura assistida por IA externa ainda não foi ativada. Nenhuma chamada a provedores externos é feita.",
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
      "Quando ativada, a leitura será gerada sob demanda a partir do payload objetivo ao lado.",
    tone: "border-border/60 bg-background/30 text-foreground",
    icon: ClipboardList,
  },
  ready: {
    label: "Leitura disponível",
    description: "Resumo objetivo gerado pela IA externa. (Renderização virá na Fase 5.)",
    tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-100",
    icon: Bot,
  },
  stale: {
    label: "Leitura desatualizada",
    description:
      "Os dados de odds mudaram desde a última geração. A leitura será regenerada quando o usuário pedir.",
    tone: "border-yellow-500/40 bg-yellow-500/5 text-yellow-100",
    icon: AlertTriangle,
  },
  error: {
    label: "Provedor externo indisponível",
    description:
      "A última tentativa falhou. Tente novamente mais tarde. Nenhum dado sensível é enviado.",
    tone: "border-red-500/40 bg-red-500/5 text-red-100",
    icon: AlertTriangle,
  },
};
