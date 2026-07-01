import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ia-prompt")({
  component: AiPromptAdminPage,
});

interface PromptRow {
  id: string;
  name: string;
  version: number;
  content: string;
  notes: string | null;
  active: boolean;
  created_at: string;
  created_by: string | null;
}

interface ApiPayload {
  prompts: PromptRow[];
  defaultTemplate: string;
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

function AiPromptAdminPage() {
  const { effectiveIsAdmin, loading: roleLoading } = useRole();
  const router = useRouter();
  const [state, setState] = useState<ApiPayload | null>(null);
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!effectiveIsAdmin) {
      router.navigate({ to: "/dashboard" });
      return;
    }
    void load();
  }, [effectiveIsAdmin, roleLoading, router]);

  async function load() {
    setLoading(true);
    try {
      const resp = await authedFetch("/api/admin/ai-prompt");
      if (!resp.ok) throw new Error(await resp.text());
      const j = (await resp.json()) as ApiPayload;
      setState(j);
      const active = j.prompts.find((p) => p.active);
      setContent((active?.content ?? j.defaultTemplate).trim());
      setNotes("");
    } catch (err) {
      toast.error("Falha ao carregar prompts", {
        description: err instanceof Error ? err.message : "erro",
      });
    } finally {
      setLoading(false);
    }
  }

  async function save(activate: boolean) {
    if (content.trim().length < 60) {
      toast.error("Prompt muito curto (mínimo 60 caracteres).");
      return;
    }
    setSaving(true);
    try {
      const resp = await authedFetch("/api/admin/ai-prompt", {
        method: "POST",
        body: JSON.stringify({ content, notes: notes.trim() || null, activate }),
      });
      const j = (await resp.json().catch(() => ({}))) as {
        error?: string;
        prompt?: PromptRow;
      };
      if (!resp.ok) throw new Error(j.error ?? "erro");
      toast.success(
        activate
          ? `Versão v${j.prompt?.version} salva e ativada`
          : `Versão v${j.prompt?.version} salva (inativa)`,
      );
      await load();
    } catch (err) {
      toast.error("Falha ao salvar", {
        description: err instanceof Error ? err.message : "erro",
      });
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setActivatingId(id);
    try {
      const resp = await authedFetch("/api/admin/ai-prompt", {
        method: "PUT",
        body: JSON.stringify({ id }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Versão ativada");
      await load();
    } catch (err) {
      toast.error("Falha ao ativar", {
        description: err instanceof Error ? err.message : "erro",
      });
    } finally {
      setActivatingId(null);
    }
  }

  function useVersion(row: PromptRow) {
    setContent(row.content);
    setNotes(row.notes ?? "");
    toast.message(`Carregado no editor: v${row.version}`);
  }

  function useDefault() {
    if (!state) return;
    setContent(state.defaultTemplate);
    setNotes("Baseado no template padrão");
    toast.message("Template padrão carregado no editor");
  }

  if (roleLoading || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Admin · IA
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Prompt da análise assistida</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Aqui você edita o "cérebro" da IA que escreve as análises dos jogos.
            Cada alteração vira uma nova versão. Apenas uma versão fica ativa por vez.
            O sistema continua respeitando as proibições de linguagem (nunca prometer
            ganho, não usar "aposte", etc.).
          </p>
        </div>
        <Link
          to="/admin/sincronizacao"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar para sincronização
        </Link>
      </header>

      <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Editor</h2>
            <p className="text-xs text-muted-foreground">
              {content.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useDefault}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Carregar template padrão
          </Button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="mt-3 h-[420px] w-full resize-y rounded-md border border-border/60 bg-background p-3 font-mono text-[12px] leading-relaxed"
          placeholder="Instruções do sistema para a IA…"
        />

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Notas desta versão (opcional)
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: tornei o resumo direto mais curto"
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => save(true)}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Salvar e ativar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => save(false)}
            disabled={saving}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar como rascunho
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Análises já geradas ficam em cache por 30 min. A nova versão passa a valer
          para as próximas gerações.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-base font-semibold">Histórico de versões</h2>
        {(!state || state.prompts.length === 0) && (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma versão salva ainda. Ao salvar pela primeira vez, o template
            padrão fica congelado como v1.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {state?.prompts.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-border/60 bg-background/50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">v{row.version}</span>
                  {row.active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Ativa
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => useVersion(row)}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Carregar no editor
                  </button>
                  {!row.active && (
                    <button
                      type="button"
                      onClick={() => activate(row.id)}
                      disabled={activatingId === row.id}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
                    >
                      {activatingId === row.id ? "Ativando…" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
              {row.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
              )}
              <p className="mt-2 line-clamp-2 font-mono text-[11px] text-muted-foreground/80">
                {row.content.slice(0, 240)}
                {row.content.length > 240 ? "…" : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
