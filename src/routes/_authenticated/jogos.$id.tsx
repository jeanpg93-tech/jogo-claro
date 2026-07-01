import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Info, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  STATUS_META,
  classifyGame,
  impliedProb,
  RULES,
  type Game,
} from "@/lib/demo-games";
import { useGame } from "@/lib/games-data";
import { isBookBR } from "@/lib/br-books";
import { KickoffCountdown } from "@/lib/kickoff-countdown";
import { flagUrl } from "@/lib/team-flags";
import { bookLogoUrl } from "@/lib/book-logos";
import { ptTeam } from "@/lib/teams-pt";
import { useAnalyticalProfile } from "@/hooks/use-analytical-profile";
import { profileLens, lensTone } from "@/lib/profile-lens";
import { RISK_OPTIONS } from "@/lib/analytical-profile";
import { GameAnalysisSection } from "@/components/game-analysis";
import { AssistedReadingSection } from "@/components/assisted-reading";


type Side = "home" | "draw" | "away";
const SIDE_LABEL: Record<Side, string> = {
  home: "Mandante",
  draw: "Empate",
  away: "Visitante",
};

export const Route = createFileRoute("/_authenticated/jogos/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Jogo ${params.id} — Visão de Jogo` }],
  }),
  component: JogoDetailPage,
});

function JogoDetailPage() {
  const { id } = Route.useParams();
  const { data: game, isLoading } = useGame(id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando jogo...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Jogo não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O jogo solicitado não existe ou já saiu da janela de cobertura.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Voltar ao painel
        </Link>
      </div>
    );
  }

  return <GameDetail game={game} />;
}

function GameDetail({ game }: { game: Game }) {
  const c = classifyGame(game);
  const meta = STATUS_META[c.status];
  const { profile } = useAnalyticalProfile();
  const lens = profileLens(c.status, profile, {
    edgePct: c.best?.edgePct ?? null,
  });
  const riskLabel =
    RISK_OPTIONS.find((r) => r.value === profile.risk_profile)?.label ?? null;
  const defaultSide: Side = c.best?.side ?? "home";

  const [pickSide, setPickSide] = useState<Side>(defaultSide);
  const [pickBook, setPickBook] = useState<string | null>(
    game.books[0]?.book ?? null,
  );
  const pickedBook = useMemo(
    () => game.books.find((b) => b.book === pickBook) ?? null,
    [game.books, pickBook],
  );
  const pickedOdd = pickedBook ? pickedBook[pickSide] : null;
  const refOdd = game.reference ? game.reference[pickSide] : null;
  const pickedEdgePp =
    pickedOdd && refOdd
      ? (impliedProb(refOdd) - impliedProb(pickedOdd)) * 100
      : null;

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
            <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold tracking-tight md:text-3xl">
              <TeamWithFlag name={game.home} />
              <span className="text-muted-foreground">vs</span>
              <TeamWithFlag name={game.away} />
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {new Date(game.kickoff).toLocaleString("pt-BR", {
                dateStyle: "full",
                timeStyle: "short",
              })}
              <KickoffCountdown kickoff={game.kickoff} books={game.books.length} />
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${game.demo ? "bg-muted" : "bg-emerald-500/15 text-emerald-300"}`}
              >
                {game.demo ? "Dados demonstrativos" : "Dados reais"}
              </span>
              {game.updatedAt && (
                <span className="text-xs">
                  · atualizado em {new Date(game.updatedAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${meta.tone}`}
          >
            {meta.label}
          </span>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{meta.description}</p>

        {lens && (
          <div
            className={`mt-4 rounded-xl border p-4 ${lensTone(lens.tone)}`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Leitura para o seu perfil{riskLabel ? ` · ${riskLabel}` : ""}
            </div>
            <div className="mt-1 text-base font-semibold">{lens.label}</div>
            <p className="mt-1 text-sm opacity-90">{lens.description}</p>
            <p className="mt-2 text-[11px] opacity-70">
              Leitura baseada em regras objetivas. A decisão final é sempre sua.
            </p>
          </div>
        )}

        <GameAnalysisSection game={game} />

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
              Odds por casa
            </h2>
            {game.books.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Sem fontes disponíveis para este jogo.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Selecione a casa e o lado que você quer considerar na sua análise.
                </p>
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-1 py-1 text-left">Casa</th>
                      <th className="px-1 py-1 text-right">Mandante</th>
                      <th className="px-1 py-1 text-right">Empate</th>
                      <th className="px-1 py-1 text-right">Visitante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...game.books]
                      .sort((a, b) => {
                        const ab = isBookBR(a.book) ? 0 : 1;
                        const bb = isBookBR(b.book) ? 0 : 1;
                        if (ab !== bb) return ab - bb;
                        return a.book.localeCompare(b.book);
                      })
                      .map((b) => {
                      const isPicked = b.book === pickBook;
                      const br = isBookBR(b.book);
                      return (
                        <tr
                          key={b.book}
                          onClick={() => setPickBook(b.book)}
                          className={`cursor-pointer border-t border-border/40 transition ${isPicked ? "bg-primary/10" : br ? "bg-emerald-500/5 hover:bg-emerald-500/10" : "hover:bg-background/60"}`}
                        >
                          <td className="px-1 py-1.5">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name="pickBook"
                                checked={isPicked}
                                onChange={() => setPickBook(b.book)}
                                className="accent-primary"
                              />
                              <BookLogoSm book={b.book} />
                              <span>{b.book}</span>
                              {br && (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                                  BR
                                </span>
                              )}
                            </label>
                          </td>
                          {(["home", "draw", "away"] as Side[]).map((s) => {
                            const selected = isPicked && pickSide === s;
                            return (
                              <td
                                key={s}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPickBook(b.book);
                                  setPickSide(s);
                                }}
                                className={`px-1 py-1.5 text-right tabular-nums ${selected ? "rounded bg-primary/30 font-semibold text-primary-foreground" : ""}`}
                              >
                                {b[s].toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">BR</span>{" "}
                  = casas que operam no Brasil. Betano, Bet365, KTO, Pixbet e outras casas exclusivamente brasileiras não são cobertas pela fonte de dados. Não exibimos links para casas de apostas.
                </p>
              </div>
            )}
          </section>
        </div>

        {pickedBook && pickedOdd && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Sua seleção
            </h2>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
              <Stat label="Casa" value={pickedBook.book} />
              <Stat label="Lado" value={SIDE_LABEL[pickSide]} />
              <Stat label="Odd escolhida" value={pickedOdd.toFixed(2)} />
              <Stat
                label="Diferença vs referência"
                value={
                  pickedEdgePp === null
                    ? "—"
                    : `${pickedEdgePp >= 0 ? "+" : ""}${pickedEdgePp.toFixed(1)} pp`
                }
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Probabilidade implícita:{" "}
              {(impliedProb(pickedOdd) * 100).toFixed(1)}%. Limiar de oportunidade
              analítica: {RULES.EDGE_THRESHOLD_PCT} pp.
            </p>
          </div>
        )}

        {c.best && (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Melhor odd do mercado (referência automática)
            </h2>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
              <Stat label="Lado destacado" value={SIDE_LABEL[c.best.side]} />
              <Stat label="Melhor odd" value={c.best.odd.toFixed(2)} />
              <Stat
                label="Diferença vs referência"
                value={`${c.best.edgePct >= 0 ? "+" : ""}${c.best.edgePct.toFixed(1)} pp`}
              />
            </div>
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
            search={{ game: game.id, side: pickSide }}
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

function TeamWithFlag({ name }: { name: string }) {
  const pt = ptTeam(name);
  const url = flagUrl(pt) ?? flagUrl(name);
  return (
    <span className="inline-flex items-center gap-2">
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-5 w-8 rounded-sm object-cover ring-1 ring-border/40"
        />
      )}
      <span>{pt}</span>
    </span>
  );
}

function BookLogoSm({ book }: { book: string }) {
  const src = bookLogoUrl(book, 32);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
      className="h-5 w-5 rounded-full bg-background object-contain ring-1 ring-border/40"
    />
  );
}
