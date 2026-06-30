import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { classifyGame, STATUS_META, type Game } from "@/lib/demo-games";
import { useGames } from "@/lib/games-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Side = "home" | "draw" | "away";
type Decision = "registrar" | "passar" | "observar";

interface JournalEntry {
  id: string;
  user_id: string;
  game_id: string;
  competition: string | null;
  home: string | null;
  away: string | null;
  kickoff: string | null;
  side: Side;
  decision: Decision;
  confidence: number;
  status_at_decision: string | null;
  notes: string | null;
  created_at: string;
}

const searchSchema = z.object({
  game: z.string().optional(),
  side: z.enum(["home", "draw", "away"]).optional(),
});

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({ meta: [{ title: "Diário pessoal — Visão de Jogo" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: DiarioPage,
});

const SIDE_LABEL: Record<Side, string> = {
  home: "Mandante",
  draw: "Empate",
  away: "Visitante",
};

const DECISION_LABEL: Record<Decision, string> = {
  registrar: "Registrei minha análise",
  passar: "Passei deste jogo",
  observar: "Vou observar",
};

function DiarioPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gameId, setGameId] = useState<string>(search.game ?? "");
  const [side, setSide] = useState<Side>(search.side ?? "home");
  const [decision, setDecision] = useState<Decision>("observar");
  const [confidence, setConfidence] = useState<number>(3);
  const [notes, setNotes] = useState("");

  const { data: gamesData } = useGames();
  const games: Game[] = useMemo(() => gamesData?.games ?? [], [gamesData]);
  const usingDemo = gamesData?.usingDemo ?? true;
  const selectedGame: Game | undefined = games.find((g) => g.id === gameId);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEntries((data ?? []) as JournalEntry[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!selectedGame) {
      toast.error("Escolha um jogo demonstrativo.");
      return;
    }
    setSaving(true);
    const status = classifyGame(selectedGame).status;
    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      game_id: selectedGame.id,
      competition: selectedGame.competition,
      home: selectedGame.home,
      away: selectedGame.away,
      kickoff: selectedGame.kickoff,
      side,
      decision,
      confidence,
      status_at_decision: status,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro adicionado ao seu diário.");
    setNotes("");
    setConfidence(3);
    setDecision("observar");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Registro removido.");
      setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diário pessoal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre suas próprias decisões e reflexões. O diário é privado e serve para
            disciplina e revisão. Não é recomendação de aposta.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 rounded-xl border border-border/60 bg-card p-5 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <Label>Jogo demonstrativo</Label>
          <Select value={gameId} onValueChange={setGameId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Escolha um jogo do painel" />
            </SelectTrigger>
            <SelectContent>
              {DEMO_GAMES.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.home} vs {g.away} — {g.competition}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGame && (
            <p className="mt-2 text-xs text-muted-foreground">
              Status atual:{" "}
              <span className="font-medium text-foreground">
                {STATUS_META[classifyGame(selectedGame).status].label}
              </span>
            </p>
          )}
        </div>

        <div>
          <Label>Lado analisado</Label>
          <Select value={side} onValueChange={(v) => setSide(v as Side)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Mandante</SelectItem>
              <SelectItem value="draw">Empate</SelectItem>
              <SelectItem value="away">Visitante</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Decisão registrada</Label>
          <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="observar">Vou observar</SelectItem>
              <SelectItem value="passar">Passei deste jogo</SelectItem>
              <SelectItem value="registrar">Registrei minha análise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Confiança na sua análise (1 a 5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label>Notas pessoais</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="O que você observou? Lesões, contexto, escalação, motivo da decisão..."
            className="mt-1 min-h-24"
          />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={saving || !selectedGame}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Adicionar ao diário
          </Button>
        </div>
      </form>

      <JournalStats entries={entries} />

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Histórico</h2>
      <p className="text-xs text-muted-foreground">
        Apenas você consegue ver e gerenciar seus registros.
      </p>

      <JournalFilters
        all={entries ?? []}
        loading={loading}
        onRemove={remove}
      />
    </div>
  );
}

function JournalFilters({
  all,
  loading,
  onRemove,
}: {
  all: JournalEntry[];
  loading: boolean;
  onRemove: (id: string) => void;
}) {
  const [fDecision, setFDecision] = useState<"all" | Decision>("all");
  const [fSide, setFSide] = useState<"all" | Side>("all");
  const [query, setQuery] = useState("");

  const filtered = all.filter((e) => {
    if (fDecision !== "all" && e.decision !== fDecision) return false;
    if (fSide !== "all" && e.side !== fSide) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${e.home ?? ""} ${e.away ?? ""} ${e.competition ?? ""} ${e.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="mt-4 grid gap-2 rounded-lg border border-border/60 bg-card p-3 md:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Buscar por time, competição ou nota…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={fDecision} onValueChange={(v) => setFDecision(v as typeof fDecision)}>
          <SelectTrigger className="md:w-48">
            <SelectValue placeholder="Decisão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as decisões</SelectItem>
            <SelectItem value="observar">Vou observar</SelectItem>
            <SelectItem value="passar">Passei deste jogo</SelectItem>
            <SelectItem value="registrar">Registrei minha análise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSide} onValueChange={(v) => setFSide(v as typeof fSide)}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Lado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os lados</SelectItem>
            <SelectItem value="home">Mandante</SelectItem>
            <SelectItem value="draw">Empate</SelectItem>
            <SelectItem value="away">Visitante</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Mostrando {filtered.length} de {all.length} registro(s).
      </p>

      <div className="mt-3 grid gap-3">
        {loading && (
          <div className="flex items-center justify-center rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}
        {!loading && all.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum registro ainda. Comece pelo{" "}
            <Link to="/dashboard" className="text-primary hover:underline">
              painel de jogos
            </Link>
            .
          </div>
        )}
        {!loading && all.length > 0 && filtered.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum registro corresponde aos filtros.
          </div>
        )}
        {filtered.map((e) => (
          <article
            key={e.id}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {e.competition ?? "—"}
                </div>
                <div className="mt-0.5 text-base font-semibold">
                  {e.home} <span className="text-muted-foreground">vs</span> {e.away}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Lado: {SIDE_LABEL[e.side]}</span>
                  <span>· Decisão: {DECISION_LABEL[e.decision]}</span>
                  <span>· Confiança: {e.confidence}/5</span>
                  {e.status_at_decision && (
                    <span>
                      · Status no momento:{" "}
                      {STATUS_META[e.status_at_decision as keyof typeof STATUS_META]
                        ?.label ?? e.status_at_decision}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(e.id)}
                  title="Excluir registro"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {e.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-background/40 p-3 text-sm">
                {e.notes}
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}


function JournalStats({ entries }: { entries: JournalEntry[] | null }) {
  if (!entries || entries.length === 0) return null;
  const total = entries.length;
  const byDecision: Record<Decision, number> = { registrar: 0, passar: 0, observar: 0 };
  const byStatus: Record<string, number> = {};
  const bySide: Record<Side, number> = { home: 0, draw: 0, away: 0 };
  let confidenceSum = 0;
  for (const e of entries) {
    byDecision[e.decision]++;
    bySide[e.side]++;
    confidenceSum += e.confidence;
    const s = e.status_at_decision ?? "—";
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const avgConf = (confidenceSum / total).toFixed(1);

  const Tile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Estatísticas do diário</h2>
      <p className="text-xs text-muted-foreground">
        Resumo objetivo do seu próprio histórico. Sem previsões, sem promessas.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total de registros" value={total} />
        <Tile label="Confiança média" value={`${avgConf}/5`} />
        <Tile
          label="Registrei análise"
          value={byDecision.registrar}
          hint={`${Math.round((byDecision.registrar / total) * 100)}% das entradas`}
        />
        <Tile
          label="Passei do jogo"
          value={byDecision.passar}
          hint={`${Math.round((byDecision.passar / total) * 100)}% das entradas`}
        />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Distribuição por lado</div>
          <div className="mt-2 space-y-1.5 text-sm">
            {(["home", "draw", "away"] as Side[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span>{SIDE_LABEL[s]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {bySide[s]} · {Math.round((bySide[s] / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            Status no momento da decisão
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            {Object.entries(byStatus).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span>
                  {STATUS_META[k as keyof typeof STATUS_META]?.label ?? k}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {v} · {Math.round((v / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

