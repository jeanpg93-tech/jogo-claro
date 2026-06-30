// Adapter OddsPapi (https://api.oddspapi.io v4).
// Apenas futebol (sportId=10), mercado 1X2 (marketId=101, outcomes 101/102/103).
// Lê ODDSPAPI_API_KEY do ambiente.
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { ODDSPAPI_TOURNAMENTS } from "@/lib/oddspapi-catalog";
import { ptTeam } from "@/lib/teams-pt";

const HOST = "https://api.oddspapi.io";
const SPORT_ID = 10; // futebol

interface TournamentRow {
  tournamentId: number;
  tournamentSlug: string;
  tournamentName: string;
  categoryName?: string;
}

interface ParticipantRow {
  participantId: number;
  participantName: string;
}

interface OddsFixtureRow {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  tournamentId: number;
  startTime: string;
  updatedAt?: string;
  hasOdds: boolean;
  bookmakerOdds?: Record<
    string,
    {
      bookmakerIsActive: boolean;
      markets?: Record<
        string,
        {
          outcomes?: Record<
            string,
            { players?: Record<string, { active: boolean; price: number }> }
          >;
        }
      >;
    }
  >;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function ptCompetition(slug: string, fallback: string): string {
  return ODDSPAPI_TOURNAMENTS.find((t) => t.slug === slug)?.label ?? fallback;
}

export interface OddsPapiOptions {
  tournaments?: string[]; // slugs selecionados
  bookmakers?: string[]; // slugs selecionados
}

export function createOddsPapiProvider(opts: OddsPapiOptions = {}): OddsProvider {
  return {
    name: "oddspapi",
    async fetchUpcomingGames(): Promise<Game[]> {
      const apiKey = process.env.ODDSPAPI_API_KEY;
      if (!apiKey) throw new Error("ODDSPAPI_API_KEY não configurada.");

      const tournamentSlugs = (opts.tournaments ?? []).filter(Boolean);
      const bookmakers = (opts.bookmakers ?? []).filter(Boolean);
      if (tournamentSlugs.length === 0 || bookmakers.length === 0) return [];

      // 1) Lista torneios do esporte e filtra pelos slugs escolhidos.
      const tournRes = await fetch(
        `${HOST}/v4/tournaments?sportId=${SPORT_ID}&apiKey=${encodeURIComponent(apiKey)}`,
      );
      if (!tournRes.ok) {
        console.error(`[oddspapi] tournaments -> ${tournRes.status}`);
        return [];
      }
      const allTourns = (await tournRes.json()) as TournamentRow[];
      const selected = allTourns.filter((t) => tournamentSlugs.includes(t.tournamentSlug));
      if (selected.length === 0) return [];
      const slugById = new Map(selected.map((t) => [t.tournamentId, t.tournamentSlug]));
      const nameById = new Map(selected.map((t) => [t.tournamentId, t.tournamentName]));
      const ids = selected.map((t) => t.tournamentId).join(",");

      // 2) Odds por torneio (uma chamada com todos os tournamentIds e bookmakers).
      const oddsUrl =
        `${HOST}/v4/odds-by-tournaments?bookmaker=${bookmakers.join(",")}` +
        `&tournamentIds=${ids}&apiKey=${encodeURIComponent(apiKey)}`;
      const oddsRes = await fetch(oddsUrl);
      if (!oddsRes.ok) {
        console.error(`[oddspapi] odds-by-tournaments -> ${oddsRes.status}`);
        return [];
      }
      const fixtures = (await oddsRes.json()) as OddsFixtureRow[];
      if (fixtures.length === 0) return [];

      // 3) Mapa de participantes (uma chamada para o esporte).
      const partRes = await fetch(
        `${HOST}/v4/participants?sportId=${SPORT_ID}&apiKey=${encodeURIComponent(apiKey)}`,
      );
      const partRows = partRes.ok ? ((await partRes.json()) as ParticipantRow[]) : [];
      const nameByPart = new Map(partRows.map((p) => [p.participantId, p.participantName]));

      // 4) Mapeia para shape canônico Game.
      const games: Game[] = [];
      for (const fx of fixtures) {
        if (!fx.hasOdds || !fx.bookmakerOdds) continue;
        const home = nameByPart.get(fx.participant1Id) ?? `Time ${fx.participant1Id}`;
        const away = nameByPart.get(fx.participant2Id) ?? `Time ${fx.participant2Id}`;

        const books: BookOdds[] = [];
        for (const [bmKey, bm] of Object.entries(fx.bookmakerOdds)) {
          if (!bm.bookmakerIsActive) continue;
          const market = bm.markets?.["101"];
          if (!market?.outcomes) continue;
          const h = market.outcomes["101"]?.players?.["0"];
          const d = market.outcomes["102"]?.players?.["0"];
          const a = market.outcomes["103"]?.players?.["0"];
          if (!h?.active || !d?.active || !a?.active) continue;
          if (!h.price || !d.price || !a.price) continue;
          // Usa o label do catálogo se existir; cai para slug original.
          const label =
            (
              await import("@/lib/oddspapi-catalog")
            ).ODDSPAPI_BOOKMAKERS.find((b) => b.slug === bmKey)?.label ?? bmKey;
          books.push({ book: label, home: h.price, draw: d.price, away: a.price });
        }
        if (books.length === 0) continue;

        const reference = {
          home: median(books.map((b) => b.home)),
          draw: median(books.map((b) => b.draw)),
          away: median(books.map((b) => b.away)),
        };

        const slug = slugById.get(fx.tournamentId);
        const competition = slug
          ? ptCompetition(slug, nameById.get(fx.tournamentId) ?? "—")
          : nameById.get(fx.tournamentId) ?? "—";

        games.push({
          id: fx.fixtureId,
          competition,
          round: "—",
          home: ptTeam(home),
          away: ptTeam(away),
          kickoff: fx.startTime,
          updatedAt: fx.updatedAt ?? null,
          reference,
          books,
          demo: false,
        });
      }

      return games;
    },
  };
}
