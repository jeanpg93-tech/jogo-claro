// Adapter OddsPapi.
// Revisado contra a documentação v4. O fluxo principal NÃO depende mais de
// /tournaments nem /bookmakers, porque algumas chaves gratuitas retornam 403
// nesses catálogos. A descoberta agora segue o tutorial oficial da Copa:
// - /fixtures?sportId=10&from=<janela>&to=<janela> para descobrir jogos/torneios
// - /odds-by-tournaments?tournamentIds=<ids>&bookmakers=<slug> para odds 1X2
// - fallback /odds?fixtureId=<id>&bookmakers=<slugs> quando necessário
// Apenas futebol (sportId=10), mercado 1X2 (home/draw/away).
// Lê ODDSPAPI_API_KEY do ambiente.
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { ODDSPAPI_TOURNAMENTS, ODDSPAPI_BOOKMAKERS } from "@/lib/oddspapi-catalog";
import { ptTeam } from "@/lib/teams-pt";

const HOST = "https://api.oddspapi.io/v4";
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

interface FixtureListRow {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  participant1Name?: string | null;
  participant1ShortName?: string | null;
  participant2Name?: string | null;
  participant2ShortName?: string | null;
  sportId?: number;
  tournamentId: number;
  tournamentSlug?: string | null;
  tournamentName?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  statusId?: number;
  hasOdds?: boolean;
  startTime: string;
  updatedAt?: string;
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

type FixtureListPayload =
  | FixtureListRow[]
  | { data?: FixtureListRow[]; fixtures?: FixtureListRow[]; result?: FixtureListRow[] }
  | Record<string, unknown>
  | null;

interface OddsFixtureRow {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  participant1Name?: string | null;
  participant1ShortName?: string | null;
  participant2Name?: string | null;
  participant2ShortName?: string | null;
  tournamentId: number;
  tournamentSlug?: string | null;
  tournamentName?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  statusId?: number;
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
          marketActive?: boolean;
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
  // v4 /participants?sportId=10 retorna um mapa { "4481": "Brasil", ... }.
  return Object.entries(payload)
    .filter(([id, name]) => /^\d+$/.test(id) && typeof name === "string")
    .map(([id, name]) => ({ participantId: Number(id), participantName: name as string }));
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

function asFixtureListRows(payload: FixtureListPayload): FixtureListRow[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as FixtureListRow[];
  if (Array.isArray(record.fixtures)) return record.fixtures as FixtureListRow[];
  if (Array.isArray(record.result)) return record.result as FixtureListRow[];
  return [];
}

function isLegacyFixture(row: OddsFixtureRow | OddsPapiFixtureRow): row is OddsFixtureRow {
  return "participant1Id" in row && "participant2Id" in row;
}

function normalizeStartTime(value: string | number): string {
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  return value;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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
    if (market?.marketActive === false) continue;
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

function fixtureTournamentSlug(row: FixtureListRow): string | null {
  return row.tournamentSlug ?? null;
}

function fixtureMatchesSelection(row: FixtureListRow, tournamentSlugs: string[]): boolean {
  const slug = fixtureTournamentSlug(row);
  if (slug && tournamentSlugs.includes(slug)) return true;

  // Fallback específico documentado pela OddsPapi para Copa do Mundo: às vezes
  // a descoberta é feita por nome/categoria em vez de catálogo de torneios.
  const name = (row.tournamentName ?? "").toLowerCase();
  const category = (row.categorySlug ?? row.categoryName ?? "").toLowerCase();
  if (tournamentSlugs.includes("world-cup")) {
    return name === "world cup" || (name.includes("world cup") && category.includes("international"));
  }
  return false;
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

    const home = bySide.home;
    const draw = bySide.draw;
    const away = bySide.away;
    if (home && draw && away) {
      const label = ODDSPAPI_BOOKMAKERS.find((b) => b.slug === bmKey)?.label ?? meta?.bookmaker ?? bmKey;
      books.push({ book: label, home, draw, away });
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

async function fetchFixtureDiscovery(apiKey: string, tournamentSlugs: string[]): Promise<FixtureListRow[]> {
  // A documentação de /fixtures limita janelas quando usamos sportId+from+to.
  // Usamos blocos de 5 dias para ficar abaixo do limite e cobrir a Copa/rodadas futuras.
  const from = addDays(new Date(), -1);
  const until = addDays(new Date(), 35);
  const discovered = new Map<string, FixtureListRow>();
  let cursor = from;
  let failures = 0;
  let lastFailure = "";

  while (cursor < until) {
    const to = addDays(cursor, 5);
    const url = apiUrl("/fixtures", {
      sportId: SPORT_ID,
      from: ymd(cursor),
      to: ymd(to < until ? to : until),
      statusId: 0,
      hasOdds: true,
      language: "pt",
      apiKey,
    });

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      const body = await responseText(res);
      failures++;
      lastFailure = `${res.status} ${body.slice(0, 180)}`;
      console.warn(`[oddspapi] fixtures ${ymd(cursor)}-${ymd(to)} -> ${lastFailure}`);
    } else {
      const rows = asFixtureListRows((await res.json().catch(() => null)) as FixtureListPayload);
      for (const row of rows) {
        if (!row?.fixtureId || !row.tournamentId) continue;
        if (!fixtureMatchesSelection(row, tournamentSlugs)) continue;
        discovered.set(row.fixtureId, row);
      }
    }

    cursor = to;
    if (cursor < until) await wait(2_100);
  }

  if (discovered.size === 0 && failures > 0) {
    throw new Error(`OddsPapi não retornou jogos nas janelas consultadas. Último retorno: ${lastFailure}`);
  }

  return Array.from(discovered.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
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

      // 1) Descobre fixtures por janelas de data, como no guia oficial da Copa.
      // Isso evita depender do catálogo /tournaments, que está retornando 403
      // para esta chave apesar de /fixtures e /odds funcionarem.
      const discoveredFixtures = await fetchFixtureDiscovery(apiKey, tournamentSlugs);
      console.log(
        `[oddspapi] fixtures descobertos: ${discoveredFixtures.length}; slugs solicitados: ${tournamentSlugs.join(",")}`,
      );
      if (discoveredFixtures.length === 0) {
        return [];
      }

      const fixtureMetaById = new Map(discoveredFixtures.map((f) => [f.fixtureId, f]));
      const tournamentRows = uniqueById(
        discoveredFixtures.map((f) => ({
          tournamentId: f.tournamentId,
          tournamentSlug: f.tournamentSlug ?? (fixtureMatchesSelection(f, ["world-cup"]) ? "world-cup" : String(f.tournamentId)),
          tournamentName: f.tournamentName ?? "—",
          categorySlug: f.categorySlug ?? undefined,
          categoryName: f.categoryName ?? undefined,
        })),
      );
      const slugById = new Map(tournamentRows.map((t) => [t.tournamentId, t.tournamentSlug]));
      const nameById = new Map(tournamentRows.map((t) => [t.tournamentId, t.tournamentName]));
      const ids = tournamentRows.map((t) => t.tournamentId).join(",");

      // 2) Odds por torneio. A documentação v4 usa o parâmetro `bookmakers`
      // (plural). Primeiro tentamos todas as casas em uma chamada; se alguma
      // restrição derrubar o lote, tentamos casa a casa e ignoramos apenas a
      // casa negada.
      const fixturesById = new Map<string, OddsFixtureRow | OddsPapiFixtureRow>();
      let successfulRequests = 0;
      let lastFailure = "";

      const mergeFixtureRows = (rows: Array<OddsFixtureRow | OddsPapiFixtureRow>) => {
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
      };

      async function fetchOddsByTournament(bookmakerList: string[], label: string) {
        const oddsUrl = apiUrl("/odds-by-tournaments", {
          bookmakers: bookmakerList.join(","),
          tournamentIds: ids,
          language: "pt",
          verbosity: 3,
          apiKey,
        });
        const oddsRes = await fetchWithRetry(oddsUrl);
        if (!oddsRes.ok) {
          const body = await responseText(oddsRes);
          lastFailure = `${label}: ${oddsRes.status} ${body.slice(0, 180)}`;
          return false;
        }
        successfulRequests++;
        const oddsJson = (await oddsRes.json().catch(() => null)) as FixturePayload;
        const rows = asFixtureRows(oddsJson);
        if (rows.length === 0) console.warn(`[oddspapi] resposta sem fixtures para ${label}.`);
        mergeFixtureRows(rows);
        return true;
      }

      const bulkOk = await fetchOddsByTournament(bookmakers, "lote");
      if (!bulkOk) {
        console.warn(`[oddspapi] lote ignorado em odds-by-tournaments: ${lastFailure}`);
        for (const [bookIndex, bookmaker] of bookmakers.entries()) {
          if (bookIndex > 0) await wait(1_100);
          const ok = await fetchOddsByTournament([bookmaker], bookmaker);
          if (!ok) console.warn(`[oddspapi] casa ignorada em odds-by-tournaments: ${lastFailure}`);
        }
      }

      // Fallback documentado: se /odds-by-tournaments não devolver payload útil,
      // consulta /odds por fixtureId. É mais caro, então só roda quando necessário.
      if (fixturesById.size === 0 && discoveredFixtures.length > 0) {
        console.warn("[oddspapi] fallback /odds por fixture ativado.");
        for (const [index, fixture] of discoveredFixtures.entries()) {
          if (index > 0) await wait(1_100);
          const res = await fetchWithRetry(
            apiUrl("/odds", {
              fixtureId: fixture.fixtureId,
              bookmakers: bookmakers.join(","),
              language: "pt",
              verbosity: 3,
              apiKey,
            }),
          );
          if (!res.ok) {
            const body = await responseText(res);
            lastFailure = `${fixture.fixtureId}: ${res.status} ${body.slice(0, 180)}`;
            console.warn(`[oddspapi] odds fixture ignorada: ${lastFailure}`);
            continue;
          }
          successfulRequests++;
          mergeFixtureRows(asFixtureRows((await res.json().catch(() => null)) as FixturePayload));
        }
      }

      if (fixturesById.size === 0 && successfulRequests === 0) {
        throw new Error(`OddsPapi não retornou odds para nenhuma casa selecionada. Último retorno: ${lastFailure}`);
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
          const meta = fixtureMetaById.get(fx.fixtureId);
          if (!fx.participant1Name && !meta?.participant1Name) neededIds.add(fx.participant1Id);
          if (!fx.participant2Name && !meta?.participant2Name) neededIds.add(fx.participant2Id);
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
            sportId: SPORT_ID,
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
        const meta = fixtureMetaById.get(fx.fixtureId);

        const home = legacy
          ? fx.participant1Name ?? meta?.participant1Name ?? meta?.participant1ShortName ?? nameByPart.get(p1Id) ?? `Time ${p1Id}`
          : fx.participants?.participant1Name ?? nameByPart.get(p1Id) ?? `Time ${p1Id}`;
        const away = legacy
          ? fx.participant2Name ?? meta?.participant2Name ?? meta?.participant2ShortName ?? nameByPart.get(p2Id) ?? `Time ${p2Id}`
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
          ? fx.tournamentName ?? meta?.tournamentName ?? nameById.get(fx.tournamentId) ?? "—"
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
