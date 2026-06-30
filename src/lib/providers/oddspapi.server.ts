// Adapter OddsPapi.
// A documentação atual usa o host v5 (https://v5.oddspapi.io/en) e endpoints REST
// como /tournaments, /bookmakers e /fixtures/odds/main. Mantemos leitura tolerante
// ao payload v4 antigo para não quebrar respostas legadas.
// Apenas futebol (sportId=10), mercado 1X2 (home/draw/away).
// Lê ODDSPAPI_API_KEY do ambiente.
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { ODDSPAPI_TOURNAMENTS, ODDSPAPI_BOOKMAKERS } from "@/lib/oddspapi-catalog";
import { ptTeam } from "@/lib/teams-pt";

const HOST = "https://v5.oddspapi.io/en";
const SPORT_ID = 10; // futebol

// OddsPapi roda atrás de Cloudflare e bloqueia requisições sem User-Agent
// reconhecível (Workers/SSR enviam UA vazio → 403 Forbidden). Forçamos
// cabeçalhos explícitos em todas as chamadas.
export const ODDSPAPI_HEADERS: HeadersInit = {
  "User-Agent": "VisaoDeJogo/1.0 (+https://visaodejogo.lovable.app)",
  Accept: "application/json",
};

interface TournamentRow {
  tournamentId: number;
  tournamentSlug: string;
  tournamentName: string;
  sportId?: number;
  categorySlug?: string;
  categoryName?: string;
  futureFixtures?: number;
  upcomingFixtures?: number;
  liveFixtures?: number;
}

interface BookmakerRow {
  bookmakerName: string;
  slug: string;
  active?: boolean;
}

interface ParticipantRow {
  participantId: number;
  participantName?: string;
  name?: string;
  participantShortName?: string;
}

type ParticipantPayload =
  | ParticipantRow[]
  | { data?: ParticipantRow[]; participants?: ParticipantRow[]; result?: ParticipantRow[] }
  | Record<string, unknown>
  | null;

type FixturePayload =
  | Array<OddsFixtureRow | OddsPapiFixtureRow>
  | {
      data?: Array<OddsFixtureRow | OddsPapiFixtureRow>;
      fixtures?: Array<OddsFixtureRow | OddsPapiFixtureRow>;
      result?: Array<OddsFixtureRow | OddsPapiFixtureRow>;
    }
  | OddsFixtureRow
  | OddsPapiFixtureRow
  | Record<string, unknown>
  | null;

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

interface OddsPapiOddQuote {
  bookmaker: string;
  outcomeId: number;
  playerId?: number;
  price: number;
  active: boolean;
  marketActive?: boolean | null;
  mainLine?: boolean | null;
  marketId?: number;
  bookmakerOutcomeId?: string | null;
  changedAt?: number;
}

interface OddsPapiFixtureRow {
  fixtureId: string;
  startTime: number | string;
  tournament?: {
    tournamentId: number;
    tournamentName: string;
    categoryName?: string | null;
  };
  participants?: {
    participant1Id: number;
    participant1Name?: string | null;
    participant1ShortName?: string | null;
    participant2Id: number;
    participant2Name?: string | null;
    participant2ShortName?: string | null;
  };
  odds?: Record<string, Record<string, OddsPapiOddQuote>>;
  bookmakers?: Record<
    string,
    {
      bookmaker: string;
      hasOdds: boolean;
      suspended?: boolean;
      staleOdds?: boolean;
      updatedAt?: string;
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

function apiUrl(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(`${HOST}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function uniqueById(rows: TournamentRow[]): TournamentRow[] {
  const byId = new Map<number, TournamentRow>();
  for (const row of rows) byId.set(row.tournamentId, row);
  return Array.from(byId.values());
}

const TOURNAMENT_ALIASES: Record<string, string> = {
  "fifa-world-cup": "world-cup",
};

const BOOKMAKER_ALIASES: Record<string, string> = {
  "betano-br": "betano.bet.br",
  "estrela-bet": "estrelabet",
  "stake-br": "stake.bet.br",
  "superbet-br": "superbet.bet.br",
  "sportingbet-br": "sportingbet.bet.br",
  "betboo-br": "betboo.bet.br",
  "brazino777-br": "brazino777.bet.br",
};

function normalizeSlugs(values: string[], aliases: Record<string, string>): string[] {
  return Array.from(new Set(values.map((value) => aliases[value] ?? value).filter(Boolean)));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asParticipantRows(payload: ParticipantPayload): ParticipantRow[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.participants)) return payload.participants;
  if (Array.isArray(payload.result)) return payload.result;
  return [];
}

function asFixtureRows(payload: FixturePayload): Array<OddsFixtureRow | OddsPapiFixtureRow> {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as Array<OddsFixtureRow | OddsPapiFixtureRow>;
  if (Array.isArray(record.fixtures)) return record.fixtures as Array<OddsFixtureRow | OddsPapiFixtureRow>;
  if (Array.isArray(record.result)) return record.result as Array<OddsFixtureRow | OddsPapiFixtureRow>;
  if ("fixtureId" in record) return [payload as OddsFixtureRow | OddsPapiFixtureRow];
  return [];
}

function isLegacyFixture(row: OddsFixtureRow | OddsPapiFixtureRow): row is OddsFixtureRow {
  return "participant1Id" in row && "participant2Id" in row;
}

function normalizeStartTime(value: string | number): string {
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  return value;
}

function participantName(row: ParticipantRow): string | undefined {
  return row.participantName ?? row.name ?? row.participantShortName;
}

function sideFromQuote(quote: OddsPapiOddQuote): "home" | "draw" | "away" | null {
  if (quote.outcomeId === 101) return "home";
  if (quote.outcomeId === 102) return "draw";
  if (quote.outcomeId === 103) return "away";

  const raw = (quote.bookmakerOutcomeId ?? "").toLowerCase().trim();
  if (["home", "h", "1"].includes(raw)) return "home";
  if (["draw", "d", "x", "tie"].includes(raw)) return "draw";
  if (["away", "a", "2"].includes(raw)) return "away";
  return null;
}

function extractLegacyBooks(row: OddsFixtureRow): BookOdds[] {
  if (!row.hasOdds || !row.bookmakerOdds) return [];
  const books: BookOdds[] = [];
  for (const [bmKey, bm] of Object.entries(row.bookmakerOdds)) {
    if (!bm.bookmakerIsActive) continue;
    const market = bm.markets?.["101"];
    if (!market?.outcomes) continue;
    const h = market.outcomes["101"]?.players?.["0"];
    const d = market.outcomes["102"]?.players?.["0"];
    const a = market.outcomes["103"]?.players?.["0"];
    if (!h?.active || !d?.active || !a?.active) continue;
    if (!h.price || !d.price || !a.price) continue;
    const label = ODDSPAPI_BOOKMAKERS.find((b) => b.slug === bmKey)?.label ?? bmKey;
    books.push({ book: label, home: h.price, draw: d.price, away: a.price });
  }
  return books;
}

function extractV5Books(row: OddsPapiFixtureRow, requestedBookmakers: string[]): BookOdds[] {
  if (!row.odds) return [];
  const allowed = new Set(requestedBookmakers);
  const books: BookOdds[] = [];

  for (const [bmKey, oddsMap] of Object.entries(row.odds)) {
    if (allowed.size > 0 && !allowed.has(bmKey)) continue;
    const meta = row.bookmakers?.[bmKey];
    if (meta && (!meta.hasOdds || meta.suspended)) continue;

    const bySide: Partial<Record<"home" | "draw" | "away", number>> = {};
    for (const quote of Object.values(oddsMap ?? {})) {
      if (!quote?.active || !quote.price || quote.price <= 1) continue;
      if (quote.marketActive === false || quote.mainLine === false) continue;
      if (quote.playerId !== undefined && quote.playerId !== 0) continue;
      const side = sideFromQuote(quote);
      if (!side) continue;
      bySide[side] = quote.price;
    }

    if (bySide.home && bySide.draw && bySide.away) {
      const label = ODDSPAPI_BOOKMAKERS.find((b) => b.slug === bmKey)?.label ?? meta?.bookmaker ?? bmKey;
      books.push({ book: label, home: bySide.home, draw: bySide.draw, away: bySide.away });
    }
  }

  return books;
}

function latestUpdatedAt(row: OddsPapiFixtureRow): string | null {
  const dates = Object.values(row.bookmakers ?? {})
    .map((b) => b.updatedAt)
    .filter((v): v is string => Boolean(v));
  return dates.sort().at(-1) ?? null;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, { headers: ODDSPAPI_HEADERS });
    last = res;
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt < attempts - 1) await wait(1_200 * (attempt + 1));
  }
  return last!;
}

async function responseText(res: Response): Promise<string> {
  return res.text().catch(() => "");
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

      const tournamentSlugs = normalizeSlugs(opts.tournaments ?? [], TOURNAMENT_ALIASES);
      const requestedBookmakers = normalizeSlugs(opts.bookmakers ?? [], BOOKMAKER_ALIASES);
      let bookmakers = requestedBookmakers;
      if (tournamentSlugs.length === 0 || bookmakers.length === 0) return [];

      // Valida os slugs de casas contra a lista viva do provedor quando a conta
      // permite consultar esse endpoint. Se a conta não tiver acesso ao catálogo,
      // seguimos com os slugs selecionados e deixamos a consulta de odds decidir.
      const booksRes = await fetchWithRetry(apiUrl("/bookmakers", { apiKey }));
      if (booksRes.ok) {
        const available = (await booksRes.json()) as BookmakerRow[];
        const valid = new Set(available.filter((b) => b.active !== false).map((b) => b.slug));
        bookmakers = requestedBookmakers.filter((b) => valid.has(b));
        const ignored = requestedBookmakers.filter((b) => !valid.has(b));
        if (ignored.length > 0) {
          console.warn(`[oddspapi] casas ignoradas por slug inválido: ${ignored.join(",")}`);
        }
      } else {
        const body = await responseText(booksRes);
        console.warn(
          `[oddspapi] não foi possível confirmar casas disponíveis (${booksRes.status}). ` +
            `Prosseguindo com as casas selecionadas. ${body.slice(0, 180)}`,
        );
      }
      if (bookmakers.length === 0) {
        throw new Error("Nenhuma casa selecionada para consultar na OddsPapi. Revise as casas no painel de sincronização.");
      }

      // 1) Lista torneios do esporte e filtra pelos slugs escolhidos.
      const tournRes = await fetchWithRetry(apiUrl("/tournaments", { sportId: SPORT_ID, apiKey }));
      if (!tournRes.ok) {
        const body = await responseText(tournRes);
        console.error(`[oddspapi] tournaments -> ${tournRes.status} ${body.slice(0, 300)}`);
        throw new Error(`OddsPapi não retornou a lista de torneios (${tournRes.status}). Tente novamente em alguns minutos.`);
      }
      const allTourns = (await tournRes.json()) as TournamentRow[];
      console.log(
        `[oddspapi] torneios retornados: ${allTourns.length}; slugs solicitados: ${tournamentSlugs.join(",")}`,
      );
      const selected = uniqueById(
        allTourns.filter(
          (t) =>
            tournamentSlugs.includes(t.tournamentSlug) &&
            !t.categorySlug?.toLowerCase().includes("simulated"),
        ),
      );
      if (selected.length === 0) {
        const sample = allTourns
          .slice(0, 40)
          .map((t) => `${t.tournamentSlug} (${t.tournamentName})`)
          .join(" | ");
        console.error(
          `[oddspapi] Nenhum torneio bateu. Amostra de slugs disponíveis: ${sample}`,
        );
        return [];
      }
      console.log(
        `[oddspapi] torneios casados: ${selected.map((t) => t.tournamentSlug).join(",")}`,
      );
      const slugById = new Map(selected.map((t) => [t.tournamentId, t.tournamentSlug]));
      const nameById = new Map(selected.map((t) => [t.tournamentId, t.tournamentName]));
      const ids = selected.map((t) => t.tournamentId).join(",");

      // 2) Odds por torneio. Na API atual, /fixtures/odds/main aceita um
      // tournamentId por chamada e múltiplas casas no parâmetro `bookmakers`.
      // Esse caminho evita os 403 observados no endpoint v4 antigo.
      const fixturesById = new Map<string, OddsFixtureRow | OddsPapiFixtureRow>();
      let failedTournaments = 0;
      let lastFailure = "";
      const bookmakerParam = bookmakers.join(",");

      for (const [index, tournament] of selected.entries()) {
        if (index > 0) await wait(1_100);
        const oddsUrl = apiUrl("/fixtures/odds/main", {
          tournamentId: tournament.tournamentId,
          bookmakers: bookmakerParam,
          apiKey,
        });
        const oddsRes = await fetchWithRetry(oddsUrl);
        if (!oddsRes.ok) {
          failedTournaments++;
          const body = await responseText(oddsRes);
          lastFailure = `${tournament.tournamentSlug}: ${oddsRes.status} ${body.slice(0, 180)}`;
          console.warn(`[oddspapi] fixtures/odds/main falhou para ${lastFailure}`);
          continue;
        }

        const oddsJson = (await oddsRes.json().catch(() => null)) as FixturePayload;
        const rows = asFixtureRows(oddsJson);
        if (rows.length === 0) {
          console.warn(`[oddspapi] resposta sem fixtures para ${tournament.tournamentSlug}.`);
        }

        for (const row of rows) {
          if (!row?.fixtureId) continue;
          const existing = fixturesById.get(row.fixtureId);
          if (!existing) {
            fixturesById.set(row.fixtureId, row);
            continue;
          }
          if (isLegacyFixture(existing) && isLegacyFixture(row)) {
            existing.bookmakerOdds = {
              ...(existing.bookmakerOdds ?? {}),
              ...(row.bookmakerOdds ?? {}),
            };
            existing.hasOdds = existing.hasOdds || row.hasOdds;
            if (row.updatedAt && (!existing.updatedAt || row.updatedAt > existing.updatedAt)) {
              existing.updatedAt = row.updatedAt;
            }
          } else if (!isLegacyFixture(existing) && !isLegacyFixture(row)) {
            existing.odds = { ...(existing.odds ?? {}), ...(row.odds ?? {}) };
            existing.bookmakers = { ...(existing.bookmakers ?? {}), ...(row.bookmakers ?? {}) };
          }
        }
      }

      if (fixturesById.size === 0 && failedTournaments === selected.length) {
        throw new Error(`OddsPapi não retornou odds para nenhum torneio. Último erro: ${lastFailure}`);
      }

      const fixtures = Array.from(fixturesById.values());
      console.log(
        `[oddspapi] fixtures recebidos: ${fixtures.length}; casas válidas: ${bookmakers.join(",")}`,
      );
      if (fixtures.length === 0) return [];

      // 3) Mapa de participantes. Na API atual, /fixtures/odds/main já traz
      // nomes dos participantes. Só consultamos /participants por ID quando
      // algum fixture vier incompleto.
      const neededIds = new Set<number>();
      for (const fx of fixtures) {
        if (isLegacyFixture(fx)) {
          neededIds.add(fx.participant1Id);
          neededIds.add(fx.participant2Id);
        } else {
          if (!fx.participants?.participant1Name) neededIds.add(fx.participants?.participant1Id ?? 0);
          if (!fx.participants?.participant2Name) neededIds.add(fx.participants?.participant2Id ?? 0);
        }
      }
      neededIds.delete(0);
      const nameByPart = new Map<number, string>();

      async function ingestParticipants(url: string) {
        const res = await fetchWithRetry(url);
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as ParticipantPayload;
        for (const p of asParticipantRows(payload)) {
          const name = participantName(p);
          if (p?.participantId && name) {
            nameByPart.set(p.participantId, name);
          }
        }
      }

      if (neededIds.size > 0) {
        await ingestParticipants(
          apiUrl("/participants", {
            participantIds: Array.from(neededIds).join(","),
            apiKey,
          }),
        );
      }
      console.log(
        `[oddspapi] participantes carregados: ${nameByPart.size}; faltando: ${
          Array.from(neededIds).filter((id) => !nameByPart.has(id)).length
        }`,
      );

      // 4) Mapeia para shape canônico Game.
      const games: Game[] = [];
      for (const fx of fixtures) {
        const legacy = isLegacyFixture(fx);
        const p1Id = legacy ? fx.participant1Id : fx.participants?.participant1Id;
        const p2Id = legacy ? fx.participant2Id : fx.participants?.participant2Id;
        if (!p1Id || !p2Id) continue;

        const home = legacy
          ? nameByPart.get(p1Id) ?? `Time ${p1Id}`
          : fx.participants?.participant1Name ?? nameByPart.get(p1Id) ?? `Time ${p1Id}`;
        const away = legacy
          ? nameByPart.get(p2Id) ?? `Time ${p2Id}`
          : fx.participants?.participant2Name ?? nameByPart.get(p2Id) ?? `Time ${p2Id}`;

        const books = legacy ? extractLegacyBooks(fx) : extractV5Books(fx, bookmakers);
        if (books.length === 0) continue;

        const reference = {
          home: median(books.map((b) => b.home)),
          draw: median(books.map((b) => b.draw)),
          away: median(books.map((b) => b.away)),
        };

        const tournamentId = legacy ? fx.tournamentId : fx.tournament?.tournamentId;
        const slug = tournamentId ? slugById.get(tournamentId) : undefined;
        const fallbackCompetition = legacy
          ? nameById.get(fx.tournamentId) ?? "—"
          : fx.tournament?.tournamentName ?? (tournamentId ? nameById.get(tournamentId) : undefined) ?? "—";
        const competition = slug ? ptCompetition(slug, fallbackCompetition) : fallbackCompetition;

        games.push({
          id: fx.fixtureId,
          competition,
          round: "—",
          home: ptTeam(home),
          away: ptTeam(away),
          kickoff: normalizeStartTime(fx.startTime),
          updatedAt: legacy ? fx.updatedAt ?? null : latestUpdatedAt(fx),
          reference,
          books,
          demo: false,
        });
      }

      return games;
    },
  };
}
