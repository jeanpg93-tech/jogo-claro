import type { Game } from "@/lib/demo-games";

/**
 * Interface de provedor externo de odds.
 * Qualquer provedor (The Odds API, API-Football, etc.) precisa implementar
 * fetchUpcomingGames retornando o shape canônico `Game` (com demo:false).
 */
export interface OddsProvider {
  name: string;
  fetchUpcomingGames(): Promise<Game[]>;
}
