// Dados demonstrativos — não são odds reais nem recomendações.
// Regras objetivas e transparentes para classificação no MVP.

export type GameStatus =
  | "sem_cobertura"
  | "aguardar_dados"
  | "sem_oportunidade"
  | "oportunidade_analitica";

export interface BookOdds {
  book: string; // nome neutro, sem link
  home: number;
  draw: number;
  away: number;
}

export interface DemoGame {
  id: string;
  competition: string;
  round: string;
  home: string;
  away: string;
  kickoff: string; // ISO
  updatedAt: string | null; // ISO ou null = aguardar dados
  reference: { home: number; draw: number; away: number } | null; // referência de mercado
  books: BookOdds[];
  notes?: string;
  demo: true;
}

// Helpers de regras objetivas (transparentes)
export const RULES = {
  // Diferença mínima da melhor odd disponível vs referência para sinalizar
  // "Oportunidade analítica". Em pontos percentuais de valor implícito.
  EDGE_THRESHOLD_PCT: 5,
  // Janela máxima desde a última atualização (em horas) para considerar dado fresco.
  MAX_DATA_AGE_HOURS: 6,
};

export function impliedProb(odd: number) {
  return 1 / odd;
}

export function bestOdd(books: BookOdds[], side: "home" | "draw" | "away") {
  return books.reduce((acc, b) => Math.max(acc, b[side]), 0);
}

export function ageInHours(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export function classifyGame(g: DemoGame): {
  status: GameStatus;
  best?: { side: "home" | "draw" | "away"; odd: number; edgePct: number };
} {
  if (!g.reference || g.books.length === 0) return { status: "sem_cobertura" };
  if (ageInHours(g.updatedAt) > RULES.MAX_DATA_AGE_HOURS) {
    return { status: "aguardar_dados" };
  }
  const sides: ("home" | "draw" | "away")[] = ["home", "draw", "away"];
  let best: { side: "home" | "draw" | "away"; odd: number; edgePct: number } | undefined;
  for (const s of sides) {
    const o = bestOdd(g.books, s);
    if (!o) continue;
    const refProb = impliedProb(g.reference[s]);
    const myProb = impliedProb(o);
    // edge positivo = a odd disponível paga MAIS do que a referência (probabilidade implícita menor).
    const edgePct = (refProb - myProb) * 100;
    if (!best || edgePct > best.edgePct) best = { side: s, odd: o, edgePct };
  }
  if (!best) return { status: "sem_cobertura" };
  if (best.edgePct >= RULES.EDGE_THRESHOLD_PCT) {
    return { status: "oportunidade_analitica", best };
  }
  return { status: "sem_oportunidade", best };
}

export const STATUS_META: Record<
  GameStatus,
  { label: string; tone: string; description: string }
> = {
  sem_cobertura: {
    label: "Sem cobertura",
    tone: "bg-muted text-muted-foreground border-border",
    description: "Não há dados suficientes para classificar este jogo.",
  },
  aguardar_dados: {
    label: "Aguardar dados",
    tone:
      "bg-amber-500/10 text-amber-300 border-amber-500/30 dark:text-amber-200",
    description: "Dados desatualizados além da janela permitida.",
  },
  sem_oportunidade: {
    label: "Sem oportunidade",
    tone: "bg-slate-500/10 text-slate-200 border-slate-500/30",
    description: "Sem diferença relevante frente à referência disponível.",
  },
  oportunidade_analitica: {
    label: "Oportunidade analítica",
    tone:
      "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    description:
      "Diferença relevante observada nos dados demonstrativos. Não é recomendação de aposta.",
  },
};

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 36e5).toISOString();
const inHours = (h: number) => new Date(now + h * 36e5).toISOString();

export const DEMO_GAMES: DemoGame[] = [
  {
    id: "g-001",
    competition: "Brasileirão Série A (demo)",
    round: "Rodada 14",
    home: "Atlético Demo",
    away: "Náutico Demo",
    kickoff: inHours(28),
    updatedAt: hoursAgo(1),
    reference: { home: 2.05, draw: 3.4, away: 3.8 },
    books: [
      { book: "Casa A", home: 2.1, draw: 3.3, away: 3.7 },
      { book: "Casa B", home: 2.25, draw: 3.4, away: 3.6 },
      { book: "Casa C", home: 2.18, draw: 3.35, away: 3.75 },
    ],
    notes: "Mandante invicto em casa nas últimas 6 partidas (dado demonstrativo).",
    demo: true,
  },
  {
    id: "g-002",
    competition: "Brasileirão Série A (demo)",
    round: "Rodada 14",
    home: "Litoral FC",
    away: "Serra United",
    kickoff: inHours(50),
    updatedAt: hoursAgo(2),
    reference: { home: 2.6, draw: 3.1, away: 2.8 },
    books: [
      { book: "Casa A", home: 2.55, draw: 3.05, away: 2.85 },
      { book: "Casa B", home: 2.6, draw: 3.1, away: 2.8 },
    ],
    demo: true,
  },
  {
    id: "g-003",
    competition: "Copa Regional (demo)",
    round: "Quartas",
    home: "Cerrado SC",
    away: "Pampa EC",
    kickoff: inHours(72),
    updatedAt: hoursAgo(12),
    reference: { home: 1.95, draw: 3.5, away: 4.0 },
    books: [
      { book: "Casa A", home: 1.9, draw: 3.5, away: 4.1 },
      { book: "Casa B", home: 1.92, draw: 3.45, away: 4.05 },
    ],
    demo: true,
  },
  {
    id: "g-004",
    competition: "Estadual (demo)",
    round: "Semifinal",
    home: "Vale FC",
    away: "Planalto AC",
    kickoff: inHours(20),
    updatedAt: hoursAgo(3),
    reference: { home: 2.2, draw: 3.2, away: 3.3 },
    books: [
      { book: "Casa A", home: 2.4, draw: 3.25, away: 3.2 },
      { book: "Casa B", home: 2.35, draw: 3.2, away: 3.25 },
      { book: "Casa C", home: 2.42, draw: 3.15, away: 3.18 },
    ],
    notes: "Visitante com desfalques confirmados (dado demonstrativo).",
    demo: true,
  },
  {
    id: "g-005",
    competition: "Série B (demo)",
    round: "Rodada 10",
    home: "Norte FC",
    away: "Sul EC",
    kickoff: inHours(96),
    updatedAt: null,
    reference: null,
    books: [],
    demo: true,
  },
  {
    id: "g-006",
    competition: "Série B (demo)",
    round: "Rodada 10",
    home: "Litoral FC",
    away: "Cerrado SC",
    kickoff: inHours(44),
    updatedAt: hoursAgo(2),
    reference: { home: 2.9, draw: 3.0, away: 2.55 },
    books: [
      { book: "Casa A", home: 2.85, draw: 3.0, away: 2.55 },
      { book: "Casa B", home: 2.9, draw: 2.95, away: 2.6 },
    ],
    demo: true,
  },
];

export function getDemoGame(id: string) {
  return DEMO_GAMES.find((g) => g.id === id);
}
