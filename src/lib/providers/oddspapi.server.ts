// Adapter OddsPapi (https://api.oddspapi.io v4).
// Apenas futebol (sportId=10), mercado 1X2 (marketId=101, outcomes 101/102/103).
// Lê ODDSPAPI_API_KEY do ambiente.
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { ODDSPAPI_TOURNAMENTS, ODDSPAPI_BOOKMAKERS } from "@/lib/oddspapi-catalog";
import { ptTeam } from "@/lib/teams-pt";

const HOST = "https://api.oddspapi.io";
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
  categorySlug?: string;
  categoryName?: string;
}

interface BookmakerRow {
  bookmakerName: string;
  slug: string;
}

interface ParticipantRow {
  participantId: number;
  participantName: string;
}

type ParticipantPayload =
  | ParticipantRow[]
  | { data?: ParticipantRow[]; participants?: ParticipantRow[]; result?: ParticipantRow[] }
  | Record<string, unknown>
  | null;

type FixturePayload =
  | OddsFixtureRow[]
  | { data?: OddsFixtureRow[]; fixtures?: OddsFixtureRow[]; result?: OddsFixtureRow[] }
  | OddsFixtureRow
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

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function ptCompetition(slug: string, fallback: string): string {
  return ODDSPAPI_TOURNAMENTS.find((t) => t.slug === slug)?.label ?? fallback;
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

function asFixtureRows(payload: FixturePayload): OddsFixtureRow[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as OddsFixtureRow[];
  if (Array.isArray(record.fixtures)) return record.fixtures as OddsFixtureRow[];
  if (Array.isArray(record.result)) return record.result as OddsFixtureRow[];
  if ("fixtureId" in record) return [payload as OddsFixtureRow];
  return [];
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

      // Valida os slugs de casas contra a lista viva do provedor. Um único slug
      // inválido faz o endpoint de odds retornar 400 e antes isso virava "0 jogos".
      const booksRes = await fetchWithRetry(
        `${HOST}/v4/bookmakers?apiKey=${encodeURIComponent(apiKey)}`,
      );
      if (booksRes.ok) {
        const available = (await booksRes.json()) as BookmakerRow[];
        const valid = new Set(available.map((b) => b.slug));
        bookmakers = requestedBookmakers.filter((b) => valid.has(b));
        const ignored = requestedBookmakers.filter((b) => !valid.has(b));
        if (ignored.length > 0) {
          console.warn(`[oddspapi] casas ignoradas por slug inválido: ${ignored.join(",")}`);
        }
      } else {
        const body = await responseText(booksRes);
        throw new Error(`OddsPapi não confirmou as casas disponíveis (${booksRes.status}). ${body.slice(0, 180)}`);
      }
      if (bookmakers.length === 0) {
        throw new Error("Nenhuma casa selecionada existe na OddsPapi. Use 'Listar torneios' e revise os slugs das casas.");
      }

      // 1) Lista torneios do esporte e filtra pelos slugs escolhidos.
      const tournRes = await fetchWithRetry(
        `${HOST}/v4/tournaments?sportId=${SPORT_ID}&apiKey=${encodeURIComponent(apiKey)}`,
      );
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

      // 2) Odds por torneio. A OddsPapi aceita exatamente UMA casa por chamada
      // no parâmetro singular `bookmaker`; juntamos as respostas por fixture.
      const fixturesById = new Map<string, OddsFixtureRow>();
      let failedBookmakers = 0;
      let lastFailure = "";

      for (const [index, bookmaker] of bookmakers.entries()) {
        if (index > 0) await wait(1_100);
        const oddsUrl =
          `${HOST}/v4/odds-by-tournaments?bookmaker=${encodeURIComponent(bookmaker)}` +
          `&tournamentIds=${encodeURIComponent(ids)}&language=pt&oddsFormat=decimal&apiKey=${encodeURIComponent(apiKey)}`;
        const oddsRes = await fetchWithRetry(oddsUrl);
        if (!oddsRes.ok) {
          failedBookmakers++;
          const body = await responseText(oddsRes);
          lastFailure = `${bookmaker}: ${oddsRes.status} ${body.slice(0, 180)}`;
          console.warn(`[oddspapi] odds-by-tournaments falhou para ${lastFailure}`);
          continue;
        }

        const oddsJson = (await oddsRes.json().catch(() => null)) as FixturePayload;
        const rows = asFixtureRows(oddsJson);
        if (rows.length === 0) {
          console.warn(`[oddspapi] resposta sem fixtures para ${bookmaker}.`);
        }

        for (const row of rows) {
          if (!row?.fixtureId) continue;
          const existing = fixturesById.get(row.fixtureId);
          if (!existing) {
            fixturesById.set(row.fixtureId, {
              ...row,
              bookmakerOdds: { ...(row.bookmakerOdds ?? {}) },
            });
            continue;
          }
          existing.bookmakerOdds = {
            ...(existing.bookmakerOdds ?? {}),
            ...(row.bookmakerOdds ?? {}),
          };
          existing.hasOdds = existing.hasOdds || row.hasOdds;
          if (row.updatedAt && (!existing.updatedAt || row.updatedAt > existing.updatedAt)) {
            existing.updatedAt = row.updatedAt;
          }
        }
      }

      if (fixturesById.size === 0 && failedBookmakers === bookmakers.length) {
        throw new Error(`OddsPapi não retornou odds para nenhuma casa. Último erro: ${lastFailure}`);
      }

      const fixtures = Array.from(fixturesById.values());
      console.log(
        `[oddspapi] fixtures recebidos: ${fixtures.length}; casas válidas: ${bookmakers.join(",")}`,
      );
      if (fixtures.length === 0) return [];

      // 3) Mapa de participantes. A v4 retorna paginado e/ou envolvido em
      // {data:[...]}, por isso buscamos por torneio e tentamos várias páginas
      // até cobrir todos os IDs que aparecem nos fixtures.
      const neededIds = new Set<number>();
      for (const fx of fixtures) {
        neededIds.add(fx.participant1Id);
        neededIds.add(fx.participant2Id);
      }
      const nameByPart = new Map<number, string>();

      async function ingestParticipants(url: string) {
        const res = await fetchWithRetry(url);
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as ParticipantPayload;
        for (const p of asParticipantRows(payload)) {
          if (p?.participantId && p.participantName) {
            nameByPart.set(p.participantId, p.participantName);
          }
        }
      }

      // Primeiro: tenta restringir aos torneios selecionados.
      await ingestParticipants(
        `${HOST}/v4/participants?sportId=${SPORT_ID}&tournamentIds=${encodeURIComponent(ids)}` +
          `&language=pt&apiKey=${encodeURIComponent(apiKey)}`,
      );

      // Fallback paginado caso ainda faltem nomes.
      let page = 1;
      while (
        Array.from(neededIds).some((id) => !nameByPart.has(id)) &&
        page <= 20
      ) {
        await ingestParticipants(
          `${HOST}/v4/participants?sportId=${SPORT_ID}&page=${page}&limit=500` +
            `&language=pt&apiKey=${encodeURIComponent(apiKey)}`,
        );
        page += 1;
      }
      console.log(
        `[oddspapi] participantes carregados: ${nameByPart.size}; faltando: ${
          Array.from(neededIds).filter((id) => !nameByPart.has(id)).length
        }`,
      );

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
            ODDSPAPI_BOOKMAKERS.find((b) => b.slug === bmKey)?.label ?? bmKey;
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
