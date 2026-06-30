import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";

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
  const { effectiveIsAdmin, isAdmin, loading } = useRole();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  }, [isAdmin, loading]);

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

      <div className="mt-6 rounded-xl border border-border/60 bg-card">
        <div className="grid grid-cols-12 border-b border-border/60 px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div className="col-span-3">Início</div>
          <div className="col-span-2">Duração</div>
          <div className="col-span-2">Provedor</div>
          <div className="col-span-1 text-right">Novos</div>
          <div className="col-span-1 text-right">Atualizados</div>
          <div className="col-span-3">Status</div>
        </div>
        {runs?.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma sincronização registrada ainda.
          </div>
        )}
        {runs?.map((r) => {
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
              <div className="col-span-1 text-right tabular-nums">{r.games_updated}</div>
              <div className="col-span-3">
                {r.error ? (
                  <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
                    Erro: {r.error.slice(0, 60)}
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
      </div>

      <div className="mt-6 rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Para configurar cron externo:</strong>{" "}
        chame <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/public/sync</code>{" "}
        com o header <code className="rounded bg-muted px-1.5 py-0.5 text-xs">x-sync-secret</code>{" "}
        contendo o valor do segredo <code className="text-xs">SYNC_SECRET</code>.
      </div>
    </div>
  );
}
