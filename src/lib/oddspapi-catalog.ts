// Catálogo curado de torneios e casas suportadas pelo OddsPapi.
// Usado pelo painel Admin (multi-select) e pelo adapter no sync.

export interface OddsPapiTournament {
  slug: string;
  label: string;
  group: string;
}

export interface OddsPapiBookmaker {
  slug: string;
  label: string;
  isBR: boolean;
}

export const ODDSPAPI_TOURNAMENTS: OddsPapiTournament[] = [
  // Seleções
  { slug: "world-cup", label: "Copa do Mundo FIFA", group: "Seleções" },
  { slug: "wc-qualification-uefa", label: "Eliminatórias Copa do Mundo — UEFA", group: "Seleções" },
  { slug: "fifa-world-cup-qualification-caf", label: "Eliminatórias Copa do Mundo — CAF", group: "Seleções" },
  { slug: "world-cup-qualification-concacaf", label: "Eliminatórias Copa do Mundo — CONCACAF", group: "Seleções" },
  // Brasil
  { slug: "brasileirao-serie-a", label: "Brasileirão Série A", group: "Brasil" },
  { slug: "brasileirao-serie-b", label: "Brasileirão Série B", group: "Brasil" },
  { slug: "copa-do-brasil", label: "Copa do Brasil", group: "Brasil" },
  // Sul-América
  { slug: "copa-libertadores", label: "Copa Libertadores", group: "Sul-América" },
  { slug: "copa-sudamericana", label: "Copa Sul-Americana", group: "Sul-América" },
  // UEFA
  { slug: "uefa-champions-league", label: "Champions League", group: "Europa (UEFA)" },
  { slug: "uefa-europa-league", label: "Europa League", group: "Europa (UEFA)" },
  // Ligas
  { slug: "premier-league", label: "Premier League (Inglaterra)", group: "Ligas europeias" },
  { slug: "laliga", label: "La Liga (Espanha)", group: "Ligas europeias" },
  { slug: "serie-a", label: "Serie A (Itália)", group: "Ligas europeias" },
  { slug: "bundesliga", label: "Bundesliga (Alemanha)", group: "Ligas europeias" },
  { slug: "ligue-1", label: "Ligue 1 (França)", group: "Ligas europeias" },
];

export const ODDSPAPI_BOOKMAKERS: OddsPapiBookmaker[] = [
  // Brasil (foco principal)
  { slug: "betano", label: "Betano", isBR: true },
  { slug: "betano.bet.br", label: "Betano BR", isBR: true },
  { slug: "bet365", label: "bet365", isBR: true },
  { slug: "kto", label: "KTO", isBR: true },
  { slug: "kto.bet.br", label: "KTO BR", isBR: true },
  { slug: "estrelabet", label: "Estrela Bet", isBR: true },
  { slug: "estrelabet.bet.br", label: "EstrelaBet BR", isBR: true },
  { slug: "stake.bet.br", label: "Stake BR", isBR: true },
  { slug: "superbet.bet.br", label: "Superbet BR", isBR: true },
  { slug: "betnacional", label: "Betnacional", isBR: true },
  { slug: "sportingbet.bet.br", label: "Sportingbet BR", isBR: true },
  { slug: "betboo.bet.br", label: "betboo BR", isBR: true },
  { slug: "brazino777.bet.br", label: "Brazino777 BR", isBR: true },
  { slug: "playpix", label: "PlayPix", isBR: true },
  // Sharps / referência
  { slug: "pinnacle", label: "Pinnacle Sports", isBR: false },
  { slug: "betfair-exchange", label: "Betfair Exchange", isBR: false },
  // Globais conhecidas
  { slug: "betsson", label: "Betsson", isBR: false },
  { slug: "betway", label: "Betway", isBR: false },
  { slug: "unibet", label: "Unibet", isBR: false },
  { slug: "1xbet", label: "1xBet", isBR: false },
];

export const DEFAULT_ODDSPAPI_TOURNAMENTS: string[] = ["world-cup"];
export const DEFAULT_ODDSPAPI_BOOKMAKERS: string[] = [
  "betano",
  "bet365",
  "kto",
  "estrelabet",
  "pinnacle",
];
