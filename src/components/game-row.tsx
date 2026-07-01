// Linha de jogo compacta com bandeiras dos times, "best odd" por lado (com
// logo da casa) e expansão para ver todas as casas.
// Uso APENAS informativo — nada é clicável para casa de apostas.
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, CalendarClock } from "lucide-react";
import { useState } from "react";
import {
  STATUS_META,
  classifyGame,
  bestOdd,
  type Game,
} from "@/lib/demo-games";
import { flagUrl } from "@/lib/team-flags";
import { bookLogoUrl } from "@/lib/book-logos";
import { isBookBR } from "@/lib/br-books";
import { ptTeam } from "@/lib/teams-pt";
import { KickoffCountdown } from "@/lib/kickoff-countdown";

type Side = "home" | "draw" | "away";
const SIDE_LABEL_SHORT: Record<Side, string> = {
  home: "Casa",
  draw: "Empate",
  away: "Fora",
};

function TeamName({ name }: { name: string }) {
  const pt = ptTeam(name);
  const flag = flagUrl(pt) ?? flagUrl(name);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {flag ? (
        <img
          src={flag}
          alt=""
          loading="lazy"
          className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border/40"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-4 w-6 shrink-0 place-items-center rounded-[2px] bg-muted text-[8px] font-bold text-muted-foreground ring-1 ring-border/40"
        >
          ⚽
        </span>
      )}
      <span className="truncate">{pt}</span>
    </div>
  );
}

function BookLogo({ book, size = 20 }: { book: string; size?: number }) {
  const src = bookLogoUrl(book, size * 2);
  if (!src) {
    return (
      <span
        aria-hidden
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground"
        title={book}
      >
        {book.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
      className="h-5 w-5 shrink-0 rounded-full bg-background object-contain ring-1 ring-border/40"
      title={book}
    />
  );
}

function BestChip({
  side,
  odd,
  book,
}: {
  side: Side;
  odd: number;
  book: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs"
      title={`${SIDE_LABEL_SHORT[side]} · melhor odd em ${book}`}
    >
      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {SIDE_LABEL_SHORT[side]}
      </span>
      <span className="font-semibold tabular-nums">{odd.toFixed(2)}</span>
      <BookLogo book={book} />
    </div>
  );
}

export function GameRow({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const c = classifyGame(game);
  const status = STATUS_META[c.status];

  // Melhor odd por lado + casa que oferece.
  const bests: Record<Side, { odd: number; book: string } | null> = {
    home: null,
    draw: null,
    away: null,
  };
  (["home", "draw", "away"] as Side[]).forEach((s) => {
    const top = bestOdd(game.books, s);
    if (!top) return;
    const b = game.books.find((x) => x[s] === top);
    if (b) bests[s] = { odd: top, book: b.book };
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-3 p-3">
        {/* Data + status */}
        <div className="flex min-w-[70px] flex-col text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {new Date(game.kickoff).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
          <span className="tabular-nums">
            {new Date(game.kickoff).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Times */}
        <Link
          to="/jogos/$id"
          params={{ id: game.id }}
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium hover:text-primary"
        >
          <TeamName name={game.home} />
          <TeamName name={game.away} />
        </Link>

        {/* Best odds compactas */}
        <div className="hidden items-center gap-1.5 md:flex">
          {(["home", "draw", "away"] as Side[]).map((s) => {
            const b = bests[s];
            if (!b) {
              return (
                <div
                  key={s}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <span className="text-[9px] uppercase tracking-wider">
                    {SIDE_LABEL_SHORT[s]}
                  </span>
                  <span>—</span>
                </div>
              );
            }
            return <BestChip key={s} side={s} odd={b.odd} book={b.book} />;
          })}
        </div>

        {/* Status + expand */}
        <div className="flex items-center gap-2">
          <span
            className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-block ${status.tone}`}
          >
            {status.label}
          </span>
          {game.books.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Ocultar casas" : "Ver todas as casas"}
              className="rounded-full border border-border/60 p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Chips em telas pequenas (fora do open) */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 md:hidden">
        {(["home", "draw", "away"] as Side[]).map((s) => {
          const b = bests[s];
          if (!b) return null;
          return <BestChip key={s} side={s} odd={b.odd} book={b.book} />;
        })}
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/30 px-3 pb-3 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Resultado final · odds por casa
            </p>
            <KickoffCountdown kickoff={game.kickoff} books={game.books.length} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-1 py-1 text-left font-medium">Casa</th>
                  <th className="px-1 py-1 text-right font-medium">Casa</th>
                  <th className="px-1 py-1 text-right font-medium">Empate</th>
                  <th className="px-1 py-1 text-right font-medium">Fora</th>
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
                    const br = isBookBR(b.book);
                    return (
                      <tr
                        key={b.book}
                        className="border-t border-border/40"
                      >
                        <td className="px-1 py-1.5">
                          <span className="flex items-center gap-2">
                            <BookLogo book={b.book} />
                            <span className="truncate">{b.book}</span>
                            {br && (
                              <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-emerald-300">
                                BR
                              </span>
                            )}
                          </span>
                        </td>
                        {(["home", "draw", "away"] as Side[]).map((s) => {
                          const isBest =
                            bests[s] && b[s] === bests[s]!.odd;
                          return (
                            <td
                              key={s}
                              className={`px-1 py-1.5 text-right tabular-nums ${isBest ? "font-semibold text-emerald-300" : ""}`}
                            >
                              {b[s] ? b[s].toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Logos e bandeiras são exibidos apenas como referência visual. Não
              exibimos links para casas de apostas.
            </span>
            <Link
              to="/jogos/$id"
              params={{ id: game.id }}
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-medium text-primary hover:bg-primary/20"
            >
              Ver análise completa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
