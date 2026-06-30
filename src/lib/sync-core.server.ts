// Orquestrador de sincronização. Executa apenas no servidor.
// Suporta múltiplos provedores ativos simultaneamente (toggle no app_settings).
import { createClient } from "@supabase/supabase-js";
import {
  getTheOddsApi,
  getOddsPapi,
  type ProviderName,
} from "./providers/index.server";
import type { OddsProvider } from "./providers/types";
import { SPORTS_CATALOG, DEFAULT_SELECTED_SPORTS } from "./sports-catalog";
import {
  DEFAULT_ODDSPAPI_BOOKMAKERS,
  DEFAULT_ODDSPAPI_TOURNAMENTS,
} from "./oddspapi-catalog";

function getAdmin() {
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

type Admin = ReturnType<typeof getAdmin>;

export interface SyncResult {
  ok: boolean;
  provider: string;
  gamesInserted: number;
  gamesUpdated: number;
  oddsInserted: number;
  durationMs: number;
  error?: string;
}

export interface MultiSyncResult {
  ok: boolean;
  results: SyncResult[];
  // Agregado, para compatibilidade com a UI atual.
  gamesInserted: number;
  gamesUpdated: number;
}

export async function runSync(): Promise<MultiSyncResult> {
  const admin = getAdmin();
  const enabled = await getProvidersEnabled(admin);

  const tasks: Array<{ name: ProviderName; provider: OddsProvider; activeLabels: string[] }> = [];

  if (enabled["the-odds-api"]) {
    const selected = (await getJsonSetting<{ sports: string[] }>(admin, "selected_sports"))?.sports;
    const sports = selected && selected.length > 0 ? selected : DEFAULT_SELECTED_SPORTS;
    const activeLabels = sports
      .map((k) => SPORTS_CATALOG.find((s) => s.key === k)?.label)
      .filter((v): v is string => Boolean(v));
    const provider = {
      ...getTheOddsApi(),
      fetchUpcomingGames: () => getTheOddsApi().fetchUpcomingGames(sports),
    };
    tasks.push({ name: "the-odds-api", provider, activeLabels });
  }

  if (enabled["oddspapi"]) {
    const tcfg = await getJsonSetting<{ tournaments: string[] }>(admin, "oddspapi_tournaments");
    const bcfg = await getJsonSetting<{ bookmakers: string[] }>(admin, "oddspapi_bookmakers");
    const tournaments =
      tcfg?.tournaments && tcfg.tournaments.length > 0
        ? tcfg.tournaments
        : DEFAULT_ODDSPAPI_TOURNAMENTS;
    const bookmakers =
      bcfg?.bookmakers && bcfg.bookmakers.length > 0
        ? bcfg.bookmakers
        : DEFAULT_ODDSPAPI_BOOKMAKERS;
    const provider = getOddsPapi({ tournaments, bookmakers });
    tasks.push({ name: "oddspapi", provider, activeLabels: [] });
  }

  const results: SyncResult[] = [];
  for (const t of tasks) {
    results.push(await runOneProvider(admin, t.name, t.provider, t.activeLabels));
  }

  const gamesInserted = results.reduce((acc, r) => acc + r.gamesInserted, 0);
  const gamesUpdated = results.reduce((acc, r) => acc + r.gamesUpdated, 0);
  return {
    ok: results.every((r) => r.ok),
    results,
    gamesInserted,
    gamesUpdated,
  };
}

async function runOneProvider(
  admin: Admin,
  providerName: ProviderName,
  provider: OddsProvider,
  activeLabels: string[],
): Promise<SyncResult> {
  const startedAt = new Date();
  let inserted = 0;
  let updated = 0;
  let oddsInserted = 0;
  let error: string | undefined;

  try {
    // Limpeza prévia para The Odds API (filtra por competition label).
    if (activeLabels.length > 0) {
      const { data: outOfScope } = await admin
        .from("games")
        .select("id")
        .eq("provider", providerName)
        .not(
          "competition",
          "in",
          `(${activeLabels.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(",")})`,
        );
      const dropIds = (outOfScope ?? []).map((r) => r.id as string);
      if (dropIds.length > 0) {
        await admin.from("game_odds").delete().in("game_id", dropIds);
        await admin.from("game_reference").delete().in("game_id", dropIds);
        await admin.from("games").delete().in("id", dropIds);
      }
    }

    const games = await provider.fetchUpcomingGames();

    for (const g of games) {
      const { data: existing } = await admin
        .from("games")
        .select("id")
        .eq("provider", providerName)
        .eq("external_id", g.id)
        .maybeSingle();

      const payload = {
        provider: providerName,
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

    // Limpa jogos antigos deste provider que saíram da lista.
    const keepIds = new Set(games.map((g) => g.id));
    const { data: allRows } = await admin
      .from("games")
      .select("id, external_id")
      .eq("provider", providerName);
    const staleIds = (allRows ?? [])
      .filter((r) => !keepIds.has(r.external_id as string))
      .map((r) => r.id as string);
    if (staleIds.length > 0) {
      await admin.from("game_odds").delete().in("game_id", staleIds);
      await admin.from("game_reference").delete().in("game_id", staleIds);
      await admin.from("games").delete().in("id", staleIds);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`[runSync ${providerName}] erro:`, error);
  }

  const finishedAt = new Date();
  await admin.from("sync_runs").insert({
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    provider: providerName,
    games_inserted: inserted,
    games_updated: updated,
    odds_inserted: oddsInserted,
    error: error ?? null,
  });

  return {
    ok: !error,
    provider: providerName,
    gamesInserted: inserted,
    gamesUpdated: updated,
    oddsInserted,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
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

// ---------- app_settings helpers ----------

async function getJsonSetting<T>(admin: Admin, key: string): Promise<T | null> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value ?? null) as T | null;
}

async function setJsonSetting(admin: Admin, key: string, value: unknown): Promise<void> {
  const { error } = await admin
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export type ProvidersEnabled = Record<ProviderName, boolean>;

const DEFAULT_PROVIDERS_ENABLED: ProvidersEnabled = {
  "the-odds-api": true,
  oddspapi: false,
};

async function getProvidersEnabled(admin: Admin): Promise<ProvidersEnabled> {
  const stored = await getJsonSetting<Partial<ProvidersEnabled>>(admin, "providers_enabled");
  return { ...DEFAULT_PROVIDERS_ENABLED, ...(stored ?? {}) };
}

// API pública usada pelos endpoints admin -------------------------------------

export async function getSelectedSportsAdmin(): Promise<string[]> {
  const admin = getAdmin();
  const v = await getJsonSetting<{ sports: string[] }>(admin, "selected_sports");
  return v?.sports ?? [];
}

export async function setSelectedSportsAdmin(sports: string[]): Promise<void> {
  await setJsonSetting(getAdmin(), "selected_sports", { sports });
}

export async function getProvidersEnabledAdmin(): Promise<ProvidersEnabled> {
  return getProvidersEnabled(getAdmin());
}

export async function setProvidersEnabledAdmin(
  next: Partial<ProvidersEnabled>,
): Promise<ProvidersEnabled> {
  const admin = getAdmin();
  const current = await getProvidersEnabled(admin);
  const merged = { ...current, ...next };
  await setJsonSetting(admin, "providers_enabled", merged);
  return merged;
}

export async function getOddsPapiSettingsAdmin(): Promise<{
  tournaments: string[];
  bookmakers: string[];
}> {
  const admin = getAdmin();
  const t = await getJsonSetting<{ tournaments: string[] }>(admin, "oddspapi_tournaments");
  const b = await getJsonSetting<{ bookmakers: string[] }>(admin, "oddspapi_bookmakers");
  return {
    tournaments: t?.tournaments ?? [],
    bookmakers: b?.bookmakers ?? [],
  };
}

export async function setOddsPapiSettingsAdmin(opts: {
  tournaments?: string[];
  bookmakers?: string[];
}): Promise<void> {
  const admin = getAdmin();
  if (opts.tournaments) {
    await setJsonSetting(admin, "oddspapi_tournaments", { tournaments: opts.tournaments });
  }
  if (opts.bookmakers) {
    await setJsonSetting(admin, "oddspapi_bookmakers", { bookmakers: opts.bookmakers });
  }
}

export interface ProviderStatus {
  name: ProviderName;
  enabled: boolean;
  keyConfigured: boolean;
}

export async function getProvidersStatusAdmin(): Promise<ProviderStatus[]> {
  const enabled = await getProvidersEnabled(getAdmin());
  return [
    {
      name: "the-odds-api",
      enabled: enabled["the-odds-api"],
      keyConfigured: Boolean(process.env.THE_ODDS_API_KEY),
    },
    {
      name: "oddspapi",
      enabled: enabled.oddspapi,
      keyConfigured: Boolean(process.env.ODDSPAPI_API_KEY),
    },
  ];
}
