// Catálogo curado de competições suportadas pela The Odds API (sport_key).
// Apenas futebol. Para adicionar mais, basta incluir aqui — o seletor
// no painel Admin lê deste arquivo.

export interface SportOption {
  key: string;
  label: string;
  group: string;
}

export const SPORTS_CATALOG: SportOption[] = [
  // FIFA
  { key: "soccer_fifa_world_cup", label: "Copa do Mundo FIFA", group: "Seleções" },
  { key: "soccer_fifa_world_cup_winner", label: "Copa do Mundo — Vencedor (futuros)", group: "Seleções" },

  // Brasil
  { key: "soccer_brazil_campeonato", label: "Brasileirão Série A", group: "Brasil" },
  { key: "soccer_brazil_serie_b", label: "Brasileirão Série B", group: "Brasil" },

  // Sul-América
  { key: "soccer_conmebol_copa_libertadores", label: "Copa Libertadores", group: "Sul-América" },
  { key: "soccer_conmebol_copa_sudamericana", label: "Copa Sul-Americana", group: "Sul-América" },

  // Europa — clubes (UEFA)
  { key: "soccer_uefa_champs_league", label: "Champions League", group: "Europa (UEFA)" },
  { key: "soccer_uefa_europa_league", label: "Europa League", group: "Europa (UEFA)" },

  // Ligas nacionais europeias
  { key: "soccer_epl", label: "Premier League (Inglaterra)", group: "Ligas europeias" },
  { key: "soccer_spain_la_liga", label: "La Liga (Espanha)", group: "Ligas europeias" },
  { key: "soccer_italy_serie_a", label: "Serie A (Itália)", group: "Ligas europeias" },
  { key: "soccer_germany_bundesliga", label: "Bundesliga (Alemanha)", group: "Ligas europeias" },
  { key: "soccer_france_ligue_one", label: "Ligue 1 (França)", group: "Ligas europeias" },
];

// Default quando ainda não há configuração salva no banco.
export const DEFAULT_SELECTED_SPORTS: string[] = ["soccer_fifa_world_cup"];
