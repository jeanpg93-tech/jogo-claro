// Orquestrador de sincronização. Executa apenas no servidor.
// Lê env vars do Cloudflare Worker, monta cliente service-role, faz upsert.
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "./providers/index.server";

function getAdmin() {
  // Usamos prefixo EXT_ porque o Lovable reserva o prefixo SUPABASE_ para
  // projetos com Lovable Cloud (não é o nosso caso — usamos Supabase externo).
  const url = process.env.EXT_SUPABASE_URL;
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "EXT_SUPABASE_URL e EXT_SUPABASE_SERVICE_ROLE_KEY são obrigatórios para sincronização.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface SyncResult {
  ok: boolean;
  provider: string;
  gamesInserted: number;
  gamesUpdated: number;
  oddsInserted: number;
  durationMs: number;
  error?: string;
}

export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date();
  const provider = getProvider();
  const admin = getAdmin();
  let inserted = 0;
  let updated = 0;
  let oddsInserted = 0;
  let error: string | undefined;

  try {
    const selectedSports = await getSelectedSports(admin);
    const games = await provider.fetchUpcomingGames(selectedSports);
    // Para cada jogo, upsert em games (por provider+external_id), depois substitui odds e reference.
    for (const g of games) {
      const { data: existing } = await admin
        .from("games")
        .select("id")
        .eq("provider", provider.name)
        .eq("external_id", g.id)
        .maybeSingle();

      const payload = {
        provider: provider.name,
        external_id: g.id,
        competition: g.competition,
        round: g.round,
        home: g.home,
        away: g.away,
        kickoff: g.kickoff,
        updated_at: g.updatedAt ?? new Date().toISOString(),
        notes: g.notes ?? null,
      };

      let gameId: string;
      if (existing?.id) {
        const { error: upErr } = await admin
          .from("games")
          .update(payload)
          .eq("id", existing.id);
        if (upErr) throw upErr;
        gameId = existing.id as string;
        updated++;
      } else {
        const { data: ins, error: insErr } = await admin
          .from("games")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) throw insErr;
        gameId = ins.id as string;
        inserted++;
      }

      // Substitui odds (delete + insert)
      await admin.from("game_odds").delete().eq("game_id", gameId);
      if (g.books.length > 0) {
        const rows = g.books.flatMap((b) => [
          { game_id: gameId, side: "home" as const, book: b.book, odd: b.home },
          { game_id: gameId, side: "draw" as const, book: b.book, odd: b.draw },
          { game_id: gameId, side: "away" as const, book: b.book, odd: b.away },
        ]);
        const { error: oddsErr } = await admin.from("game_odds").insert(rows);
        if (oddsErr) throw oddsErr;
        oddsInserted += rows.length;
      }

      // Upsert da referência
      if (g.reference) {
        await admin.from("game_reference").upsert(
          {
            game_id: gameId,
            home: g.reference.home,
            draw: g.reference.draw,
            away: g.reference.away,
          },
          { onConflict: "game_id" },
        );
      } else {
        await admin.from("game_reference").delete().eq("game_id", gameId);
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error("[runSync] erro:", error);
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  // Registra auditoria
  await admin.from("sync_runs").insert({
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    provider: provider.name,
    games_inserted: inserted,
    games_updated: updated,
    odds_inserted: oddsInserted,
    error: error ?? null,
  });

  return {
    ok: !error,
    provider: provider.name,
    gamesInserted: inserted,
    gamesUpdated: updated,
    oddsInserted,
    durationMs,
    error,
  };
}

export async function verifyAdminFromToken(token: string): Promise<boolean> {
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return Boolean(roles?.some((r) => r.role === "admin"));
}
