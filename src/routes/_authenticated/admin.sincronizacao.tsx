import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { SPORTS_CATALOG, DEFAULT_SELECTED_SPORTS } from "@/lib/sports-catalog";
import {
  ODDSPAPI_BOOKMAKERS,
  ODDSPAPI_TOURNAMENTS,
  DEFAULT_ODDSPAPI_BOOKMAKERS,
  DEFAULT_ODDSPAPI_TOURNAMENTS,
} from "@/lib/oddspapi-catalog";

function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`mt-6 rounded-xl border border-border/60 bg-card ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </button>
        {actions && open && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      title={`Copiar ${label}`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copiar
        </>
      )}
    </button>
  );
}

export const Route = createFileRoute("/_authenticated/admin/sincronizacao")({
  head: () => ({ meta: [{ title: "Sincronização — Admin · Visão de Jogo" }] }),
  component: AdminSyncPage,
});

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  provider: string;
  games_inserted: number;
  games_updated: number;
  odds_inserted: number;
  error: string | null;
}

function AdminSyncPage() {
  const { effectiveIsAdmin } = useRole();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cadence, setCadence] = useState<{
    decision: {
      skip: boolean;
      intervalMin: number;
      reason: string;
      nextKickoffIso: string | null;
      minutesUntilKickoff: number | null;
    };
    lastSyncAt: string | null;
    nextEligibleAt: string | null;
    now: string;
  } | null>(null);

  async function load() {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setRefreshing(false);
    if (error) toast.error(error.message);
    else setRuns((data ?? []) as SyncRun[]);

    // Cadência adaptativa
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin/cadence", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setCadence(await res.json());
      }
    } catch {
      // silencioso — a UI mostra "—" quando cadence for null
    }
  }

  useEffect(() => {
    if (effectiveIsAdmin) load();
  }, [effectiveIsAdmin]);


  async function triggerSync() {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Entre novamente.");
        return;
      }
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? `Falha na sincronização (${res.status}).`);
      } else if (body.ok === false) {
        const firstError = Array.isArray(body.results)
          ? body.results.find((r: { error?: string }) => r.error)?.error
          : undefined;
        toast.error(firstError ?? body.error ?? "Sincronização concluída com erro no provedor.");
      } else {
        toast.success(
          `Sincronização concluída: ${body.gamesInserted ?? 0} novos, ${body.gamesUpdated ?? 0} atualizados.`,
        );
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setSyncing(false);
    }
  }

  if (!effectiveIsAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página é visível somente para administradores em modo Admin.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Voltar ao painel
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sincronização</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize manualmente os dados externos e auditе as execuções
            realizadas pelo cron.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Recarregar
          </Button>
          <Button onClick={triggerSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar agora
          </Button>
        </div>
      </div>

      <CollapsibleSection
        title="Histórico de sincronizações"
        subtitle="Últimas execuções (manuais e via cron)."
        badge={
          runs && (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {runs.length}
            </span>
          )
        }
        className="!mt-6 !p-0"
      >
        <div className="-mx-5 -mb-5 rounded-b-xl border-t border-border/60">
          <div className="grid grid-cols-12 border-b border-border/60 px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <div className="col-span-3">Início</div>
            <div className="col-span-2">Duração</div>
            <div className="col-span-2">Provedor</div>
            <div className="col-span-1 text-right">Novos</div>
            <div className="col-span-2 text-right">Atualizados</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {runs?.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma sincronização registrada ainda.
            </div>
          )}
          {(showAllRuns ? runs : runs?.slice(0, 5))?.map((r) => {
            const dur = r.finished_at
              ? Math.max(
                  0,
                  new Date(r.finished_at).getTime() - new Date(r.started_at).getTime(),
                )
              : null;
            return (
              <div
                key={r.id}
                className="grid grid-cols-12 items-center border-b border-border/40 px-4 py-3 text-sm last:border-b-0"
              >
                <div className="col-span-3 text-xs">
                  {new Date(r.started_at).toLocaleString("pt-BR")}
                </div>
                <div className="col-span-2 text-xs tabular-nums">
                  {dur !== null ? `${(dur / 1000).toFixed(1)}s` : "—"}
                </div>
                <div className="col-span-2 text-xs">{r.provider}</div>
                <div className="col-span-1 text-right tabular-nums">{r.games_inserted}</div>
                <div className="col-span-2 text-right tabular-nums">{r.games_updated}</div>
                <div className="col-span-2 flex justify-end">
                  {r.error ? (
                    <span
                      title={r.error}
                      className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300"
                    >
                      Erro
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      OK
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {runs && runs.length > 5 && (
            <div className="border-t border-border/40 px-4 py-2 text-center">
              <button
                onClick={() => setShowAllRuns((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showAllRuns ? "Mostrar menos" : `Ver todas (${runs.length})`}
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <ProvidersPanel />

      <SportsSelector />

      <OddsPapiSelector />

      <CronDocs />
    </div>
  );
}

interface SettingsResponse {
  sports: string[];
  providers: { name: "the-odds-api" | "oddspapi"; enabled: boolean; keyConfigured: boolean }[];
  oddspapi: { tournaments: string[]; bookmakers: string[] };
}

async function fetchSettings(method: "GET" | "POST", body?: unknown): Promise<SettingsResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const res = await fetch("/api/admin/sync-settings", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string })?.error ?? `Erro ${res.status}`);
  return json as SettingsResponse;
}

function ProvidersPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"the-odds-api" | "oddspapi" | null>(null);
  const [providers, setProviders] = useState<SettingsResponse["providers"]>([]);

  useEffect(() => {
    fetchSettings("GET")
      .then((r) => setProviders(r.providers))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(name: "the-odds-api" | "oddspapi", enabled: boolean) {
    setSaving(name);
    try {
      const r = await fetchSettings("POST", { providers: { [name]: enabled } });
      setProviders(r.providers);
      toast.success(`${labelOf(name)} ${enabled ? "ativada" : "desativada"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  function labelOf(name: "the-odds-api" | "oddspapi") {
    return name === "the-odds-api" ? "The Odds API" : "OddsPapi";
  }

  return (
    <CollapsibleSection
      title="Provedores de odds"
      subtitle="Ative ou desative cada fonte independentemente. Desligado = não consome cota nem grava jogos."
    >
      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <div>
                <div className="text-sm font-medium">{labelOf(p.name)}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Chave:{" "}
                  <span className={p.keyConfigured ? "text-emerald-400" : "text-amber-400"}>
                    {p.keyConfigured ? "configurada" : "ausente"}
                  </span>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={p.enabled}
                  disabled={saving === p.name || !p.keyConfigured}
                  onChange={(e) => toggle(p.name, e.target.checked)}
                />
                <span>{p.enabled ? "Ativo" : "Inativo"}</span>
                {saving === p.name && <Loader2 className="h-3 w-3 animate-spin" />}
              </label>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function OddsPapiSelector() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [tournaments, setTournaments] = useState<Set<string>>(new Set());
  const [bookmakers, setBookmakers] = useState<Set<string>>(new Set());

  const tournGroups = useMemo(() => {
    const g = new Map<string, typeof ODDSPAPI_TOURNAMENTS>();
    for (const t of ODDSPAPI_TOURNAMENTS) {
      const list = g.get(t.group) ?? [];
      list.push(t);
      g.set(t.group, list);
    }
    return Array.from(g.entries());
  }, []);

  useEffect(() => {
    fetchSettings("GET")
      .then((r) => {
        const op = r.providers.find((p) => p.name === "oddspapi");
        setEnabled(Boolean(op?.enabled));
        const validTournaments = new Set(ODDSPAPI_TOURNAMENTS.map((x) => x.slug));
        const validBookmakers = new Set(ODDSPAPI_BOOKMAKERS.map((x) => x.slug));
        const t = (r.oddspapi.tournaments.length > 0
          ? r.oddspapi.tournaments
          : DEFAULT_ODDSPAPI_TOURNAMENTS
        ).filter((s) => validTournaments.has(s));
        const b = (r.oddspapi.bookmakers.length > 0
          ? r.oddspapi.bookmakers
          : DEFAULT_ODDSPAPI_BOOKMAKERS
        ).filter((s) => validBookmakers.has(s));
        setTournaments(new Set(t));
        setBookmakers(new Set(b));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleSet(set: Set<string>, key: string, setFn: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFn(next);
  }

  async function save() {
    if (tournaments.size === 0 || bookmakers.size === 0) {
      toast.error("Selecione ao menos 1 torneio e 1 casa.");
      return;
    }
    setSaving(true);
    try {
      await fetchSettings("POST", {
        oddspapi: {
          tournaments: Array.from(tournaments),
          bookmakers: Array.from(bookmakers),
        },
      });
      toast.success("Configuração OddsPapi salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando OddsPapi…
        </div>
      </section>
    );
  }

  if (!enabled) return null;

  return (
    <CollapsibleSection
      title="OddsPapi — torneios e casas"
      badge={
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-sky-300">
          Provedor: OddsPapi
        </span>
      }
      subtitle="Selecione os torneios e as casas que serão buscados na OddsPapi. Casas BR aparecem com destaque."
      actions={
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      }
    >
      <LiveTournamentsList />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-3">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Torneios ({tournaments.size})
          </div>
          {tournGroups.map(([group, items]) => (
            <div key={group} className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                {group}
              </div>
              <div className="mt-1 space-y-1">
                {items.map((t) => (
                  <label
                    key={t.slug}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background/50"
                  >
                    <input
                      type="checkbox"
                      checked={tournaments.has(t.slug)}
                      onChange={() => toggleSet(tournaments, t.slug, setTournaments)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="flex-1">{t.label}</span>
                    <code className="text-[10px] text-muted-foreground">{t.slug}</code>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Casas ({bookmakers.size})
          </div>
          <div className="mt-3 space-y-1">
            {[...ODDSPAPI_BOOKMAKERS]
              .sort((a, b) => Number(b.isBR) - Number(a.isBR))
              .map((b) => (
                <label
                  key={b.slug}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background/50"
                >
                  <input
                    type="checkbox"
                    checked={bookmakers.has(b.slug)}
                    onChange={() => toggleSet(bookmakers, b.slug, setBookmakers)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="flex-1">{b.label}</span>
                  {b.isBR && (
                    <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
                      BR
                    </span>
                  )}
                  <code className="text-[10px] text-muted-foreground">{b.slug}</code>
                </label>
              ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

interface LiveTournament {
  tournamentId: number;
  tournamentSlug: string;
  tournamentName: string;
  categoryName?: string;
  futureFixtures?: number;
}

function LiveTournamentsList() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LiveTournament[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const res = await fetch("/api/admin/oddspapi-tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Erro ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
      }
      setItems(json.tournaments as LiveTournament[]);
      setWarning(typeof json.warning === "string" ? json.warning : null);
      toast.success(`${json.count} torneios carregados.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao listar.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.tournamentSlug.toLowerCase().includes(q) ||
        t.tournamentName.toLowerCase().includes(q) ||
        (t.categoryName ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Torneios disponíveis na OddsPapi (ao vivo)</div>
          <div className="text-[11px] text-muted-foreground">
            Use esta lista para descobrir o slug correto e adicionar manualmente
            acima (ou me enviar para eu incluir no catálogo).
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Listar torneios
        </Button>
      </div>
      {items && (
        <>
          {warning && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {warning}
            </div>
          )}
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por nome ou país (ex.: world, brasil, copa)"
            className="mt-3 w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm"
          />
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">Nome</th>
                  <th className="px-2 py-1 text-left">País</th>
                  <th className="px-2 py-1 text-left">Slug</th>
                  <th className="px-2 py-1 text-right">Jogos futuros</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.tournamentId} className="border-t border-border/30">
                    <td className="px-2 py-1">{t.tournamentName}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {t.categoryName ?? "—"}
                    </td>
                    <td className="px-2 py-1">
                      <code className="text-[10px]">{t.tournamentSlug}</code>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {t.futureFixtures ?? 0}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">
                      Nenhum torneio bate com o filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}



function SportsSelector() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const g = new Map<string, typeof SPORTS_CATALOG>();
    for (const s of SPORTS_CATALOG) {
      const list = g.get(s.group) ?? [];
      list.push(s);
      g.set(s.group, list);
    }
    return Array.from(g.entries());
  }, []);

  async function authedFetch(method: "GET" | "POST", body?: unknown) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    const res = await fetch("/api/admin/sync-settings", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
    return json as { sports: string[] };
  }

  useEffect(() => {
    authedFetch("GET")
      .then((r) => {
        const list = r.sports.length > 0 ? r.sports : DEFAULT_SELECTED_SPORTS;
        setSelected(new Set(list));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      toast.error("Selecione ao menos 1 competição.");
      return;
    }
    setSaving(true);
    try {
      await authedFetch("POST", { sports: Array.from(selected) });
      toast.success("Competições atualizadas. Próximo sync usará esta lista.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleSection
      title="The Odds API — competições"
      badge={
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
          Provedor: The Odds API
        </span>
      }
      subtitle="Marque apenas as competições que devem ser buscadas na próxima sincronização da The Odds API. Cada competição consome ~1 crédito por execução."
      actions={
        <>
          <span className="text-xs text-muted-foreground">
            {selected.size} selecionada(s) · ~{selected.size} crédito(s)/sync
          </span>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(([group, items]) => (
            <div key={group} className="rounded-lg border border-border/60 p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {group}
              </div>
              <div className="mt-2 space-y-1.5">
                {items.map((s) => {
                  const checked = selected.has(s.key);
                  return (
                    <label
                      key={s.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.key)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="flex-1">{s.label}</span>
                      <code className="text-[10px] text-muted-foreground">
                        {s.key}
                      </code>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function CronDocs() {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/sync`
      : "/api/public/sync";
  const headerLine = "x-sync-secret: <valor do segredo SYNC_SECRET>";
  const ghYaml = `name: Sync Visão de Jogo
on:
  schedule:
    - cron: "0 11,23 * * *"   # 08:00 e 20:00 BRT
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: POST /api/public/sync
        run: |
          curl -fsS -X POST "${url}" \\
            -H "x-sync-secret: \${{ secrets.SYNC_SECRET }}"`;
  return (
    <CollapsibleSection
      title="Cron e automação"
      subtitle="Configure um agendador externo para chamar a sincronização automaticamente."
      defaultOpen={false}
    >
      <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
        <h3 className="text-base font-semibold">Cron externo (recomendado)</h3>
        <p className="mt-1 text-muted-foreground">
          Casas abrem odds em momentos diferentes — quanto mais perto do
          kickoff, mais casas cotam. Cadência sugerida em duas faixas para
          capturar melhor a abertura sem estourar o plano Free (500/mês):
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">Janela ampla:</strong> 2x/dia
            (08:00 e 20:00 BRT) → ~60 chamadas/mês. Cobre a abertura geral.
          </li>
          <li>
            <strong className="text-foreground">Janela densa (dias de jogo):</strong>{" "}
            até 4x/dia em dias com jogos selecionados → ~120 chamadas/mês.
            Captura mais casas conforme o kickoff se aproxima.
          </li>
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Use a janela ampla agora; suba para densa nos dias de rodada da Copa.
          Total estimado combinado: &lt; 200 chamadas/mês.
        </p>
        <div className="mt-3 space-y-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Endpoint
              </div>
              <CopyButton value={url} label="endpoint" />
            </div>
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 text-xs">
              POST {url}
            </code>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Header de segurança
              </div>
              <CopyButton value={headerLine} label="header" />
            </div>
            <code className="mt-1 block rounded bg-muted px-2 py-1.5 text-xs">
              {headerLine}
            </code>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
        <h3 className="text-base font-semibold">Exemplo: cron-job.org (grátis)</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>Crie uma conta em cron-job.org.</li>
          <li>
            Novo job → URL acima, método <strong>POST</strong>.
          </li>
          <li>
            Em <em>Advanced → Headers</em>, adicione{" "}
            <code className="rounded bg-muted px-1">x-sync-secret</code> com o valor
            do segredo.
          </li>
          <li>
            Agendamento: ex.: <code className="rounded bg-muted px-1">08:00</code> e{" "}
            <code className="rounded bg-muted px-1">20:00</code> diariamente.
          </li>
          <li>O histórico aparecerá nesta tela após cada execução.</li>
        </ol>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 text-sm md:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Alternativa: GitHub Actions</h3>
          <CopyButton value={ghYaml} label="YAML do GitHub Actions" />
        </div>
        <p className="mt-1 text-muted-foreground">
          Salve em{" "}
          <code className="rounded bg-muted px-1">.github/workflows/sync.yml</code>{" "}
          no seu repositório e configure o secret <code>SYNC_SECRET</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed">
          {ghYaml}
        </pre>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 md:col-span-2">
        <strong>Atenção ao consumo:</strong> cada execução faz 1 chamada à The Odds
        API (1 crédito). Somente o mercado 1X2 e a região configurada são
        consultados. O cron em si não consome créditos — apenas as chamadas
        externas.
      </div>
      </div>
    </CollapsibleSection>
  );
}

