// Fase 6 — Contrato da "Análise assistida por jogo".
// Uma análise por jogo, cacheada e reutilizada para todos os usuários.
// A IA é externa (nunca a IA nativa do Lovable) e a chave fica em Secret.

import type { Game } from "@/lib/demo-games";
import { analyzeGame } from "@/lib/game-analysis";

export const ASSISTED_READING_ENABLED = true;

export type AssistedStatus =
  | "sem_cobertura"
  | "aguardar_dados"
  | "sem_oportunidade"
  | "oportunidade_analitica";

export type PerfilKey =
  | "conservador"
  | "equilibrado"
  | "agressivo"
  | "oportunista"
  | "iniciante";

export interface AssistedReadingPayload {
  status: AssistedStatus;
  resumo: string;
  qualidade_dados: string;
  leitura_odds: string;
  comparacao_referencia: string;
  riscos: string[];
  pontos_atencao: string[];
  perfis: Record<PerfilKey, string>;
  conclusao: string;
  aguardar_dados_motivo: string | null;
}

export type AssistedReadingUiStatus =
  | "disabled"
  | "not_configured"
  | "insufficient_data"
  | "empty"
  | "loading"
  | "ready"
  | "stale"
  | "blocked"
  | "quota_exceeded"
  | "error";

// O que a IA externa recebe: apenas números objetivos. Cache é por jogo,
// não por usuário — a análise base é a mesma para todos.
export interface AssistedReadingInput {
  gameId: string;
  competition: string;
  round: string;
  home: string;
  away: string;
  kickoffISO: string;
  updatedAtISO: string | null;
  demo: boolean;
  coverage: {
    totalBooks: number;
    brBooks: number;
    hasReference: boolean;
    ageHours: number;
    fresh: boolean;
  };
  consensus: Array<{
    side: "home" | "draw" | "away";
    bestOdd: number;
    worstOdd: number;
    medianOdd: number;
    meanImpliedPct: number;
    refImpliedPct: number | null;
    edgePp: number | null;
    spreadPp: number;
  }>;
}

export function buildAssistedReadingInput(game: Game): AssistedReadingInput {
  const a = analyzeGame(game);
  return {
    gameId: game.id,
    competition: game.competition,
    round: game.round,
    home: game.home,
    away: game.away,
    kickoffISO: game.kickoff,
    updatedAtISO: game.updatedAt,
    demo: game.demo,
    coverage: a.coverage,
    consensus: a.sides.map((s) => ({
      side: s.side,
      bestOdd: s.bestOdd,
      worstOdd: s.worstOdd,
      medianOdd: s.medianOdd,
      meanImpliedPct: s.meanImpliedPct,
      refImpliedPct: s.refImpliedPct,
      edgePp: s.edgePp,
      spreadPp: s.spreadPp,
    })),
  };
}
