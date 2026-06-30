// Camada de leitura dos jogos a partir do Supabase (cliente browser).
// Faz fallback para o dataset demonstrativo quando não há jogos reais ainda.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_GAMES, type Game, type BookOdds } from "@/lib/demo-games";

interface GameRow {
  id: string;
  external_id: string;
  provider: string;
  competition: string;
  round: string | null;
  home: string;
  away: string;
  kickoff: string;
  updated_at: string | null;
  notes: string | null;
}
interface OddsRow {
  game_id: string;
  side: "home" | "draw" | "away";
  book: string;
  odd: number;
}
interface RefRow {
  game_id: string;
  home: number;
  draw: number;
  away: number;
}

function rowsToGame(
  row: GameRow,
  oddsRows: OddsRow[],
  refRow: RefRow | undefined,
): Game {
  const byBook = new Map<string, BookOdds>();
  for (const o of oddsRows) {
    let entry = byBook.get(o.book);
    if (!entry) {
      entry = { book: o.book, home: 0, draw: 0, away: 0 };
      byBook.set(o.book, entry);
    }
    entry[o.side] = Number(o.odd);
  }
  const books = Array.from(byBook.values()).filter(
    (b) => b.home && b.draw && b.away,
  );
  return {
    id: row.external_id,
    competition: row.competition,
    round: row.round ?? "—",
    home: row.home,
    away: row.away,
    kickoff: row.kickoff,
    updatedAt: row.updated_at,
    reference: refRow
      ? { home: Number(refRow.home), draw: Number(refRow.draw), away: Number(refRow.away) }
      : null,
    books,
    notes: row.notes ?? undefined,
    demo: false,
  };
}

async function fetchAllGames(): Promise<{ games: Game[]; usingDemo: boolean; lastSync: string | null }> {
  const { data: gameRows, error } = await supabase
    .from("games")
    .select("*")
    .order("kickoff", { ascending: true });
  if (error) {
    console.error("[fetchAllGames] erro:", error.message);
    return { games: DEMO_GAMES, usingDemo: true, lastSync: null };
  }
  const rows = (gameRows ?? []) as GameRow[];
  if (rows.length === 0) {
    return { games: DEMO_GAMES, usingDemo: true, lastSync: null };
  }
  const ids = rows.map((r) => r.id);
  const [{ data: odds }, { data: refs }] = await Promise.all([
    supabase.from("game_odds").select("*").in("game_id", ids),
    supabase.from("game_reference").select("*").in("game_id", ids),
  ]);
  const oddsByGame = new Map<string, OddsRow[]>();
  for (const o of (odds ?? []) as OddsRow[]) {
    const list = oddsByGame.get(o.game_id) ?? [];
    list.push(o);
    oddsByGame.set(o.game_id, list);
  }
  const refByGame = new Map<string, RefRow>();
  for (const r of (refs ?? []) as RefRow[]) refByGame.set(r.game_id, r);

  const games = rows.map((r) =>
    rowsToGame(r, oddsByGame.get(r.id) ?? [], refByGame.get(r.id)),
  );
  const lastSync = rows
    .map((r) => r.updated_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1) ?? null;
  return { games, usingDemo: false, lastSync };
}

export function useGames() {
  return useQuery({
    queryKey: ["games"],
    queryFn: fetchAllGames,
    staleTime: 60_000,
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: ["games", id],
    queryFn: async () => {
      const all = await fetchAllGames();
      return all.games.find((g) => g.id === id) ?? null;
    },
    staleTime: 60_000,
  });
}
