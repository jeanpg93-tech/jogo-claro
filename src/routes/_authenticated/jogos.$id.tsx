import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Info } from "lucide-react";
import {
  STATUS_META,
  classifyGame,
  getDemoGame,
  impliedProb,
  RULES,
  type DemoGame,
} from "@/lib/demo-games";

export const Route = createFileRoute("/_authenticated/jogos/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Jogo ${params.id} — Visão de Jogo` }],
  }),
  loader: ({ params }) => {
    const game = getDemoGame(params.id);
    if (!game) throw notFound();
    return { game };
  },
  component: JogoDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Jogo não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O jogo demonstrativo solicitado não existe.
      </p>
      <Link
        to="/dashboard"
        className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Voltar ao painel
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Erro ao carregar o jogo</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function JogoDetailPage() {
  const { game } = Route.useLoaderData() as { game: DemoGame };
  const c = classifyGame(game);
  const meta = STATUS_META[c.status];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {game.competition} · {game.round}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {game.home} <span className="text-muted-foreground">vs</span>{" "}
              {game.away}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {new Date(game.kickoff).toLocaleString("pt-BR", {
                dateStyle: "full",
                timeStyle: "short",
              })}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                Dados demonstrativos
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${meta.tone}`}
          >
            {meta.label}
          </span>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{meta.description}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-border/60 bg-background/30 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Referência de mercado
            </h2>
            {game.reference ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <RefCell label="Mandante" odd={game.reference.home} />
                <RefCell label="Empate" odd={game.reference.draw} />
                <RefCell label="Visitante" odd={game.reference.away} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Sem referência disponível.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border/60 bg-background/30 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Odds disponíveis (demo)
            </h2>
            {game.books.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Sem fontes demonstrativas para este jogo.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-1 py-1 text-left">Fonte</th>
                      <th className="px-1 py-1 text-right">M</th>
                      <th className="px-1 py-1 text-right">E</th>
                      <th className="px-1 py-1 text-right">V</th>
                    </tr>
                  </thead>
                  <tbody>
                    {game.books.map((b) => (
                      <tr key={b.book} className="border-t border-border/40">
                        <td className="px-1 py-1.5">{b.book}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">
                          {b.home.toFixed(2)}
                        </td>
                        <td className="px-1 py-1.5 text-right tabular-nums">
                          {b.draw.toFixed(2)}
                        </td>
                        <td className="px-1 py-1.5 text-right tabular-nums">
                          {b.away.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Não exibimos links para casas de apostas.
                </p>
              </div>
            )}
          </section>
        </div>

        {c.best && (
          <div className="mt-6 rounded-xl border border-border/60 bg-background/30 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Comparativo com a referência
            </h2>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
              <Stat
                label="Lado destacado"
                value={
                  c.best.side === "home"
                    ? "Mandante"
                    : c.best.side === "draw"
                      ? "Empate"
                      : "Visitante"
                }
              />
              <Stat label="Melhor odd disponível" value={c.best.odd.toFixed(2)} />
              <Stat
                label="Diferença vs referência"
                value={`${c.best.edgePct >= 0 ? "+" : ""}${c.best.edgePct.toFixed(1)} pp`}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Probabilidade implícita da melhor odd:{" "}
              {(impliedProb(c.best.odd) * 100).toFixed(1)}%. Limiar para classificar
              como oportunidade analítica: {RULES.EDGE_THRESHOLD_PCT} pp.
            </p>
          </div>
        )}

        {game.notes && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{game.notes}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/30 p-3">
          <p className="text-xs text-muted-foreground">
            Quer registrar sua leitura deste jogo? Use o diário pessoal — é privado e
            não envia nenhuma aposta.
          </p>
          <Link
            to="/diario"
            search={{ game: game.id, side: c.best?.side ?? "home" }}
            className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Registrar no diário
          </Link>
        </div>

        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          Visão de Jogo não recebe apostas, não executa apostas e não promete
          resultados. As classificações são geradas por regras objetivas e
          transparentes a partir dos dados disponíveis.
        </div>
      </div>
    </div>
  );
}

function RefCell({ label, odd }: { label: string; odd: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {odd.toFixed(2)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {(impliedProb(odd) * 100).toFixed(1)}%
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
