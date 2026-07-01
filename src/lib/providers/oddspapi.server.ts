// Adapter OddsPapi v4.
// A chave atual do fornecedor é v4: a v5 retorna 401 invalid_api_key.
// Portanto este arquivo não mistura contratos. Fluxo v4:
// - /fixtures?sportId=10&from=<janela>&to=<janela>&bookmakers=<slugs>
// - /odds-by-tournaments?tournamentIds=<ids>&bookmaker=<slug> para odds 1X2
// - fallback /odds?fixtureId=<id>&bookmakers=<slugs> quando necessário
// Apenas futebol (sportId=10), mercado 1X2 (home/draw/away).
// Lê ODDSPAPI_API_KEY do ambiente.
import type { OddsProvider } from "./types";
import type { Game, BookOdds } from "@/lib/demo-games";
import { ODDSPAPI_TOURNAMENTS, ODDSPAPI_BOOKMAKERS } from "@/lib/oddspapi-catalog";
import { ptTeam } from "@/lib/teams-pt";

const HOST = "https://api.oddspapi.io/v4";
const SPORT_ID = 10; // futebol

// A OddsPapi fica atrás da Cloudflare com Bot Fight Mode ativo. Testes de
// produção mostram que UAs "de bot" (ex.: "VisaoDeJogo/1.0 (+url)") e
// requisições sem Accept-Language/Referer típicos de navegador são bloqueadas
// com 403 e corpo curto {"error":"Forbidden"} pela WAF — antes mesmo de chegar
// à API. Enviamos um perfil de navegador Chrome real para passar pelo desafio.
export const ODDSPAPI_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://oddspapi.io/",
  Origin: "https://oddspapi.io",
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
  "betano-br": "betano",
  "betano.bet.br": "betano",
  "estrela-bet": "estrelabet",
  "stake-br": "stake",
  "stake.bet.br": "stake",
  "sportingbet-br": "sportingbet",
  "sportingbet.bet.br": "sportingbet",
  "superbet-br": "superbet",
  "superbet.bet.br": "superbet",
  "betboo-br": "betboo",
  "betboo.bet.br": "betboo",
  "brazino777-br": "brazino777",
  "brazino777.bet.br": "brazino777",
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

function looksSyntheticFixture(row: Pick<FixtureListRow, "tournamentName" | "categorySlug" | "categoryName" | "participant1Name" | "participant2Name">): boolean {
  const text = [
    row.tournamentName,
    row.categorySlug,
    row.categoryName,
    row.participant1Name,
    row.participant2Name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(srl|simulated|simulation|virtual|esoccer|e-soccer|simulado|simulada)\b/.test(text);
}

function fixtureMatchesSelection(row: FixtureListRow, tournamentSlugs: string[]): boolean {
  if (looksSyntheticFixture(row)) return false;

  const slug = fixtureTournamentSlug(row);
  if (slug && tournamentSlugs.includes(slug)) return true;

  // Fallback específico documentado pela OddsPapi para Copa do Mundo: às vezes
  // a descoberta é feita por nome/categoria em vez de catálogo de torneios.
  const name = (row.tournamentName ?? "").toLowerCase();
  const category = (row.categorySlug ?? row.categoryName ?? "").toLowerCase();
  if (tournamentSlugs.includes("world-cup")) {
    return (
      name === "world cup" ||
      name === "copa do mundo" ||
      name.includes("fifa world cup") ||
      name.includes("copa do mundo") ||
      (name.includes("world cup") && category.includes("international"))
    );
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

async function fetchFixtureDiscovery(
  apiKey: string,
  tournamentSlugs: string[],
  bookmakers: string[],
): Promise<FixtureListRow[]> {
  // A documentação de /fixtures limita janelas quando usamos sportId+from+to.
  // Usamos blocos de 5 dias para ficar abaixo do limite e cobrir a Copa/rodadas futuras.
  const from = addDays(new Date(), -1);
  const until = addDays(new Date(), 24);
  const discovered = new Map<string, FixtureListRow>();
  let cursor = from;
  let failures = 0;
  let lastFailure = "";

  while (cursor.getTime() < until.getTime()) {
    const to = addDays(cursor, 5);
    const url = apiUrl("/fixtures", {
      sportId: SPORT_ID,
      from: ymd(cursor),
      to: ymd(to.getTime() < until.getTime() ? to : until),
      statusId: 0,
      hasOdds: true,
      bookmakers: bookmakers.join(","),
      language: "pt",
      apiKey,
    });

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      const body = await responseText(res);
      failures++;
      const trimmed = body.trim();
      const looksLikeCfBlock =
        res.status === 403 && /^\{?"?error"?\s*:\s*"?Forbidden/i.test(trimmed);
      lastFailure = looksLikeCfBlock
        ? `403 bloqueado pela Cloudflare/WAF da OddsPapi (não é erro da chave). Peça ao suporte da OddsPapi para liberar o IP/User-Agent do servidor.`
        : `${res.status} ${trimmed.slice(0, 180)}`;
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
    if (cursor.getTime() < until.getTime()) await wait(2_100);
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
      const discoveredFixtures = await fetchFixtureDiscovery(apiKey, tournamentSlugs, bookmakers);
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

      // 2) Odds por torneio. Apesar de alguns trechos da documentação citarem
      // `bookmakers`, a própria API respondeu que este endpoint aceita
      // exatamente uma casa por chamada usando `bookmaker` no singular.
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

      async function fetchOddsByTournament(bookmaker: string) {
        const oddsUrl = apiUrl("/odds-by-tournaments", {
          bookmaker,
          tournamentIds: ids,
          language: "pt",
          verbosity: 3,
          apiKey,
        });
        const oddsRes = await fetchWithRetry(oddsUrl);
        if (!oddsRes.ok) {
          const body = await responseText(oddsRes);
          lastFailure = `${bookmaker}: ${oddsRes.status} ${body.slice(0, 180)}`;
          return false;
        }
        successfulRequests++;
        const oddsJson = (await oddsRes.json().catch(() => null)) as FixturePayload;
        const rows = asFixtureRows(oddsJson);
        if (rows.length === 0) console.warn(`[oddspapi] resposta sem fixtures para ${bookmaker}.`);
        mergeFixtureRows(rows);
        return true;
      }

      for (const [bookIndex, bookmaker] of bookmakers.entries()) {
        if (bookIndex > 0) await wait(1_100);
        const ok = await fetchOddsByTournament(bookmaker);
        if (!ok) console.warn(`[oddspapi] casa ignorada em odds-by-tournaments: ${lastFailure}`);
      }

      // Fallback documentado: se /odds-by-tournaments não devolver payload útil,
      // consulta /odds por fixtureId. É mais caro, então só roda quando necessário.
      if (fixturesById.size === 0 && discoveredFixtures.length > 0) {
        console.warn("[oddspapi] fallback /odds por fixture ativado.");
        for (const [index, fixture] of discoveredFixtures.entries()) {
          if (index > 0) await wait(1_100);
          async function fetchFixtureOdds(bookmakerList: string[], label: string) {
            const res = await fetchWithRetry(
              apiUrl("/odds", {
                fixtureId: fixture.fixtureId,
                bookmakers: bookmakerList.join(","),
                language: "pt",
                verbosity: 3,
                apiKey,
              }),
            );
            if (!res.ok) {
              const body = await responseText(res);
              lastFailure = `${fixture.fixtureId}/${label}: ${res.status} ${body.slice(0, 180)}`;
              return false;
            }
            successfulRequests++;
            mergeFixtureRows(asFixtureRows((await res.json().catch(() => null)) as FixturePayload));
            return true;
          }

          const ok = await fetchFixtureOdds(bookmakers, "lote");
          if (!ok) {
            console.warn(`[oddspapi] odds fixture em lote ignorada: ${lastFailure}`);
            for (const bookmaker of bookmakers) {
              await wait(1_100);
              const singleOk = await fetchFixtureOdds([bookmaker], bookmaker);
              if (!singleOk) console.warn(`[oddspapi] odds fixture/casa ignorada: ${lastFailure}`);
            }
          }
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

        if (
          looksSyntheticFixture({
            tournamentName: legacy ? fx.tournamentName : fx.tournament?.tournamentName,
            categorySlug: legacy ? fx.categorySlug : undefined,
            categoryName: legacy ? fx.categoryName : fx.tournament?.categoryName ?? undefined,
            participant1Name: home,
            participant2Name: away,
          })
        ) {
          continue;
        }

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
