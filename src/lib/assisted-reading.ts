// Fase 4 — Shell da "Leitura assistida" (IA externa).
// Nesta fase NÃO chamamos nenhuma IA. Só definimos:
// - o contrato do prompt/entrada que uma IA externa receberá no futuro;
// - a feature flag global (desligada por padrão);
// - a tipagem dos registros persistidos em `ai_readings` (Fase 5).
//
// Regras firmes:
// - A IA nativa do Lovable NUNCA será usada neste produto.
// - Quando ligada, a Fase 5 chamará um provedor externo com chave em Secret
//   server-side (nunca no bundle) via `createServerFn`.
// - A leitura assistida é opcional, informativa e nunca contém "aposte agora",
//   "palpite", "lucro", "garantido" ou linguagem equivalente.

import type { Game } from "@/lib/demo-games";
import { analyzeGame } from "@/lib/game-analysis";

// Feature flag: ligada apenas quando a Fase 5 estiver implantada.
export const ASSISTED_READING_ENABLED = false;

export type AssistedReadingStatus =
  | "disabled" // feature flag desligada
  | "insufficient_data" // dados objetivos insuficientes para gerar contexto
  | "empty" // ainda não gerada para este jogo
  | "ready" // leitura gerada (Fase 5)
  | "stale" // leitura ficou desatualizada frente aos dados atuais
  | "error"; // provedor externo falhou

// Contrato que a IA externa receberá. Apenas números e rótulos objetivos
// derivados das odds e da referência. Sem opiniões, sem histórico de aposta.
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
  // Restrições que o provedor externo DEVE respeitar no output.
  constraints: {
    language: "pt-BR";
    maxWords: 120;
    forbiddenTerms: [
      "aposte", "aposte agora", "palpite", "palpite certeiro",
      "lucro", "lucro certo", "renda", "renda extra",
      "garantido", "certeza", "infalível", "robô vencedor",
    ];
    mustInclude: [
      "linguagem responsável",
      "menciona que a decisão final é do usuário",
    ];
  };
}

export interface AssistedReading {
  id: string;
  gameId: string;
  provider: string; // ex: "openai:gpt-5-mini" (definido em Fase 5)
  createdAt: string;
  inputHash: string; // hash do AssistedReadingInput no momento da geração
  summary: string; // texto curto em pt-BR
  cautions: string[]; // pontos de atenção objetivos
  tokensIn: number;
  tokensOut: number;
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
    constraints: {
      language: "pt-BR",
      maxWords: 120,
      forbiddenTerms: [
        "aposte", "aposte agora", "palpite", "palpite certeiro",
        "lucro", "lucro certo", "renda", "renda extra",
        "garantido", "certeza", "infalível", "robô vencedor",
      ],
      mustInclude: [
        "linguagem responsável",
        "menciona que a decisão final é do usuário",
      ],
    },
  };
}

// Estado calculado (sem chamar IA). A Fase 5 substituirá parte disto
// consultando a tabela `ai_readings` no Supabase.
export function computeAssistedStatus(
  game: Game,
  existing: AssistedReading | null = null,
): AssistedReadingStatus {
  if (!ASSISTED_READING_ENABLED) return "disabled";
  const a = analyzeGame(game);
  if (!a.coverage.hasReference || a.coverage.totalBooks < 3) {
    return "insufficient_data";
  }
  if (!existing) return "empty";
  // heurística simples: se dados mudaram há mais de 3h desde a geração
  const generatedAt = new Date(existing.createdAt).getTime();
  const updatedAt = game.updatedAt ? new Date(game.updatedAt).getTime() : 0;
  if (updatedAt > generatedAt + 3 * 3600_000) return "stale";
  return "ready";
}
