// Fase 3 — Estrutura da "Análise do Jogo".
// Todas as métricas aqui são calculadas por regras objetivas e transparentes
// a partir dos dados disponíveis (odds das casas + referência de mercado).
// Nenhuma IA é usada. Nenhuma recomendação de aposta é gerada.

import {
  RULES,
  ageInHours,
  bestOdd,
  impliedProb,
  type Game,
} from "@/lib/demo-games";

export type Side = "home" | "draw" | "away";
export const SIDES: Side[] = ["home", "draw", "away"];
export const SIDE_LABEL: Record<Side, string> = {
  home: "Mandante",
  draw: "Empate",
  away: "Visitante",
};

export interface SideConsensus {
  side: Side;
  bestOdd: number;
  worstOdd: number;
  medianOdd: number;
  meanImpliedPct: number; // média das prob. implícitas entre casas (%)
  refImpliedPct: number | null; // prob. implícita da referência (%)
  edgePp: number | null; // diferença em pontos percentuais (melhor odd vs referência)
  spreadPp: number; // dispersão (best-worst) em pp de prob. implícita
}

export interface CoverageInfo {
  totalBooks: number;
  brBooks: number;
  hasReference: boolean;
  ageHours: number; // Infinity se sem updatedAt
  fresh: boolean; // dentro da janela RULES.MAX_DATA_AGE_HOURS
}

export interface GameAnalysis {
  sides: SideConsensus[];
  coverage: CoverageInfo;
  bestSide: SideConsensus | null; // maior edge
  disagreementSide: SideConsensus | null; // maior dispersão entre casas
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const BR_HINT = /(betano|bet365|kto|pixbet|sportingbet|betnacional|superbet|estrelabet|betfair|blaze|galera|betsul|bet7k|betmgm\.br)/i;
function isBR(book: string) {
  return BR_HINT.test(book);
}

export function analyzeGame(game: Game): GameAnalysis {
  const sides: SideConsensus[] = SIDES.map((side) => {
    const odds = game.books.map((b) => b[side]).filter((o) => o > 0);
    const impliedPcts = odds.map((o) => impliedProb(o) * 100);
    const bestO = odds.length ? bestOdd(game.books, side) : 0;
    const worstO = odds.length ? Math.min(...odds) : 0;
    const refPct = game.reference
      ? impliedProb(game.reference[side]) * 100
      : null;
    const mean =
      impliedPcts.length > 0
        ? impliedPcts.reduce((a, b) => a + b, 0) / impliedPcts.length
        : 0;
    const spread =
      odds.length >= 2
        ? impliedProb(worstO) * 100 - impliedProb(bestO) * 100
        : 0;
    const edge =
      refPct !== null && bestO > 0
        ? refPct - impliedProb(bestO) * 100
        : null;
    return {
      side,
      bestOdd: bestO,
      worstOdd: worstO,
      medianOdd: median(odds),
      meanImpliedPct: mean,
      refImpliedPct: refPct,
      edgePp: edge,
      spreadPp: spread,
    };
  });

  const bestSide =
    sides
      .filter((s) => s.edgePp !== null)
      .sort((a, b) => (b.edgePp ?? -Infinity) - (a.edgePp ?? -Infinity))[0] ??
    null;
  const disagreementSide =
    [...sides].sort((a, b) => b.spreadPp - a.spreadPp)[0] ?? null;

  const totalBooks = game.books.length;
  const brBooks = game.books.filter((b) => isBR(b.book)).length;
  const ageH = ageInHours(game.updatedAt);
  const coverage: CoverageInfo = {
    totalBooks,
    brBooks,
    hasReference: !!game.reference,
    ageHours: ageH,
    fresh: ageH <= RULES.MAX_DATA_AGE_HOURS,
  };

  return { sides, coverage, bestSide, disagreementSide };
}

export function formatEdge(pp: number | null): string {
  if (pp === null) return "—";
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${pp.toFixed(1)} pp`;
}

export function formatAge(hours: number): string {
  if (!isFinite(hours)) return "sem registro";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours / 24)} d`;
}
