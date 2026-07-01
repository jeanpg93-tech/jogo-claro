// Fase 3 — Shell visual da "Análise do Jogo".
// Módulos objetivos calculados a partir dos dados disponíveis.
// Nenhum módulo aqui usa IA. O placeholder de "fatores externos" indica
// que virá em fases futuras via fonte externa, nunca da IA nativa do Lovable.

import { AlertTriangle, BarChart3, Clock, Layers, Sparkles } from "lucide-react";
import { RULES, type Game } from "@/lib/demo-games";
import {
  SIDE_LABEL,
  analyzeGame,
  formatAge,
  formatEdge,
  type SideConsensus,
} from "@/lib/game-analysis";

export function GameAnalysisSection({ game }: { game: Game }) {
  const a = analyzeGame(game);

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> Análise do jogo
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Regras objetivas · sem IA
          </h2>
        </div>
        <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          MVP · Fase 3
        </span>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Cada módulo abaixo é derivado apenas das odds das casas e da referência
        de mercado. Nenhuma métrica é gerada por inteligência artificial e nada
        aqui é sugestão de aposta.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <CoverageCard coverage={a.coverage} />
        <ConsensusCard sides={a.sides} />
        <DisagreementCard side={a.disagreementSide} />
        <EdgeCard side={a.bestSide} />
      </div>

      <ExternalFactorsPlaceholder />
    </section>
  );
}

function CoverageCard({ coverage }: { coverage: ReturnType<typeof analyzeGame>["coverage"] }) {
  const tone =
    coverage.totalBooks === 0
      ? "border-muted bg-muted/20"
      : !coverage.hasReference
        ? "border-amber-500/30 bg-amber-500/5"
        : !coverage.fresh
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-emerald-500/30 bg-emerald-500/5";
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <ModuleHeader
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Cobertura e frescor"
      />
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          Casas cobrindo:{" "}
          <b>{coverage.totalBooks}</b>
          {coverage.brBooks > 0 && (
            <span className="ml-1 text-emerald-300">
              (das quais {coverage.brBooks} operam no Brasil)
            </span>
          )}
        </li>
        <li>
          Referência de mercado:{" "}
          <b>{coverage.hasReference ? "disponível" : "indisponível"}</b>
        </li>
        <li>
          Última atualização há <b>{formatAge(coverage.ageHours)}</b>
          {" · "}
          {coverage.fresh ? (
            <span className="text-emerald-300">dentro da janela</span>
          ) : (
            <span className="text-amber-300">fora da janela</span>
          )}{" "}
          (limite {RULES.MAX_DATA_AGE_HOURS}h).
        </li>
      </ul>
    </div>
  );
}

function ConsensusCard({ sides }: { sides: SideConsensus[] }) {
  const anyData = sides.some((s) => s.bestOdd > 0);
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <ModuleHeader
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Consenso entre casas"
      />
      {!anyData ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Sem odds disponíveis para calcular o consenso.
        </p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left">Lado</th>
              <th className="text-right">Prob. média</th>
              <th className="text-right">Referência</th>
              <th className="text-right">Melhor odd</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sides.map((s) => (
              <tr key={s.side} className="border-t border-border/40">
                <td className="py-1.5">{SIDE_LABEL[s.side]}</td>
                <td className="text-right">
                  {s.bestOdd > 0 ? `${s.meanImpliedPct.toFixed(1)}%` : "—"}
                </td>
                <td className="text-right">
                  {s.refImpliedPct !== null
                    ? `${s.refImpliedPct.toFixed(1)}%`
                    : "—"}
                </td>
                <td className="text-right">
                  {s.bestOdd > 0 ? s.bestOdd.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Probabilidade implícita = 1 ÷ odd. A média é feita entre as casas
        listadas neste jogo.
      </p>
    </div>
  );
}

function DisagreementCard({ side }: { side: SideConsensus | null }) {
  if (!side || side.spreadPp <= 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <ModuleHeader
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Dispersão entre casas"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Sem dispersão relevante para destacar.
        </p>
      </div>
    );
  }
  const strong = side.spreadPp >= 3;
  return (
    <div
      className={`rounded-xl border p-4 ${strong ? "border-yellow-500/40 bg-yellow-500/5" : "border-border/60 bg-background/30"}`}
    >
      <ModuleHeader
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="Dispersão entre casas"
      />
      <p className="mt-2 text-sm">
        Maior dispersão observada no lado{" "}
        <b>{SIDE_LABEL[side.side]}</b>: melhor{" "}
        <b>{side.bestOdd.toFixed(2)}</b> · pior{" "}
        <b>{side.worstOdd.toFixed(2)}</b> ({side.spreadPp.toFixed(1)} pp).
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Dispersões grandes tendem a indicar mercados em movimento ou visões
        diferentes entre casas. Apenas informativo.
      </p>
    </div>
  );
}

function EdgeCard({ side }: { side: SideConsensus | null }) {
  if (!side || side.edgePp === null) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <ModuleHeader
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Diferença vs referência"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Sem referência de mercado para comparar.
        </p>
      </div>
    );
  }
  const meets = side.edgePp >= RULES.EDGE_THRESHOLD_PCT;
  return (
    <div
      className={`rounded-xl border p-4 ${meets ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-background/30"}`}
    >
      <ModuleHeader
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        label="Diferença vs referência"
      />
      <p className="mt-2 text-sm">
        Melhor diferença no lado <b>{SIDE_LABEL[side.side]}</b>:{" "}
        <b>{formatEdge(side.edgePp)}</b>
        {" "}(melhor odd {side.bestOdd.toFixed(2)} vs referência{" "}
        {side.refImpliedPct !== null
          ? `${side.refImpliedPct.toFixed(1)}%`
          : "—"}).
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Limite objetivo para "oportunidade analítica":{" "}
        {RULES.EDGE_THRESHOLD_PCT} pp.{" "}
        {meets ? "Critério atingido." : "Critério não atingido."}
      </p>
    </div>
  );
}

function ExternalFactorsPlaceholder() {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-border/60 bg-background/20 p-4">
      <ModuleHeader
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Fatores externos (fases futuras)"
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Escalações confirmadas, desfalques, forma recente, arbitragem e clima
        entrarão em fases futuras, sempre a partir de fontes externas e com
        atribuição visível. Nada aqui será gerado pela IA nativa do Lovable.
      </p>
      <ul className="mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
        <li>· Escalações e desfalques</li>
        <li>· Forma recente e H2H</li>
        <li>· Contexto de competição</li>
        <li>· Movimentação de linha</li>
      </ul>
    </div>
  );
}

function ModuleHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {icon} {label}
    </div>
  );
}
