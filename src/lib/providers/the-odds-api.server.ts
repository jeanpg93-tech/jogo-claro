// Implementação para https://the-odds-api.com (sports: soccer_*).
// Lê THE_ODDS_API_KEY do ambiente. Apenas mercado h2h (1X2).
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { SPORTS_CATALOG } from "@/lib/sports-catalog";
import { ptTeam } from "@/lib/teams-pt";

// Esportes alvo iniciais. Pode expandir via env ODDS_SPORTS (CSV).
// Default usado apenas como fallback se nenhuma lista for fornecida.
const FALLBACK_SPORTS = ["soccer_fifa_world_cup"];

function ptLabel(sportKey: string, fallback: string): string {
  return SPORTS_CATALOG.find((s) => s.key === sportKey)?.label ?? fallback;
}

interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function createTheOddsApiProvider(): OddsProvider {
  return {
    name: "the-odds-api",
    async fetchUpcomingGames(selectedSports?: string[]): Promise<Game[]> {
      const apiKey = process.env.THE_ODDS_API_KEY;
      if (!apiKey) throw new Error("THE_ODDS_API_KEY não configurada.");

      const sports =
        selectedSports && selectedSports.length > 0
          ? selectedSports
          : (process.env.ODDS_SPORTS?.split(",").map((s) => s.trim()).filter(Boolean)) ??
            FALLBACK_SPORTS;

      const games: Game[] = [];

      for (const sport of sports) {
        const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
        url.searchParams.set("apiKey", apiKey);
        url.searchParams.set("regions", "eu,uk,us");
        url.searchParams.set("markets", "h2h");
        url.searchParams.set("oddsFormat", "decimal");
        url.searchParams.set("dateFormat", "iso");

        const res = await fetch(url);
        if (!res.ok) {
          // Não derruba o sync — registra e segue para o próximo esporte.
          console.error(`[the-odds-api] ${sport} -> ${res.status} ${res.statusText}`);
          continue;
        }
        const events = (await res.json()) as TheOddsApiEvent[];

        for (const ev of events) {
          const books: BookOdds[] = [];
          for (const bm of ev.bookmakers) {
            const h2h = bm.markets.find((m) => m.key === "h2h");
            if (!h2h) continue;
            const home = h2h.outcomes.find((o) => o.name === ev.home_team)?.price;
            const away = h2h.outcomes.find((o) => o.name === ev.away_team)?.price;
            const draw = h2h.outcomes.find((o) => o.name === "Draw")?.price;
            if (!home || !away || !draw) continue;
            books.push({ book: bm.title, home, draw, away });
          }

          const reference =
            books.length > 0
              ? {
                  home: median(books.map((b) => b.home)),
                  draw: median(books.map((b) => b.draw)),
                  away: median(books.map((b) => b.away)),
                }
              : null;

          const latestUpdate = ev.bookmakers
            .map((b) => b.last_update)
            .sort()
            .at(-1) ?? null;

          games.push({
            id: ev.id, // será external_id no banco
            competition: ptLabel(ev.sport_key, ev.sport_title),
            round: "—",
            home: ev.home_team,
            away: ev.away_team,
            kickoff: ev.commence_time,
            updatedAt: latestUpdate,
            reference,
            books,
            demo: false,
          });
        }
      }

      return games;
    },
  };
}
