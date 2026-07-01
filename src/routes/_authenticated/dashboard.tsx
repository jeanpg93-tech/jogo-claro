import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Loader2, Search } from "lucide-react";
import {
  STATUS_META,
  classifyGame,
  type GameStatus,
} from "@/lib/demo-games";
import { useGames } from "@/lib/games-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import { useAnalyticalProfile } from "@/hooks/use-analytical-profile";
import { profileLens } from "@/lib/profile-lens";
import { RISK_OPTIONS } from "@/lib/analytical-profile";
import { GameRow } from "@/components/game-row";



export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Visão de Jogo" }] }),
  component: DashboardPage,
});

const FILTERS: { value: "todos" | GameStatus; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "oportunidade_analitica", label: "Oportunidade analítica" },
  { value: "sem_oportunidade", label: "Sem oportunidade" },
  { value: "aguardar_dados", label: "Aguardar dados" },
  { value: "sem_cobertura", label: "Sem cobertura" },
];

const ALL_COMPETITIONS = "__all__";


function DashboardPage() {
  const { effectiveIsAdmin, isAdmin, viewMode } = useRole();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("todos");
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState<string>(ALL_COMPETITIONS);

  const { data, isLoading } = useGames();
  const { profile } = useAnalyticalProfile();
  const games = data?.games ?? [];
  const usingDemo = data?.usingDemo ?? true;
  const lastSync = data?.lastSync ?? null;
  const riskLabel =
    RISK_OPTIONS.find((r) => r.value === profile.risk_profile)?.label ?? null;


  const competitions = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) set.add(g.competition);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [games]);

  const items = useMemo(() => {
    return games.map((g) => ({ g, c: classifyGame(g) })).filter(({ g, c }) => {
      if (filter !== "todos" && c.status !== filter) return false;
      if (competition !== ALL_COMPETITIONS && g.competition !== competition) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        g.home.toLowerCase().includes(q) ||
        g.away.toLowerCase().includes(q) ||
        g.competition.toLowerCase().includes(q)
      );
    });
  }, [filter, query, competition, games]);


  const counts = useMemo(() => {
    const acc: Record<GameStatus, number> = {
      sem_cobertura: 0,
      aguardar_dados: 0,
      sem_oportunidade: 0,
      oportunidade_analitica: 0,
    };
    for (const g of games) acc[classifyGame(g).status]++;
    return acc;
  }, [games]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de jogos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {usingDemo ? (
              <>
                Exibindo dados <strong className="text-foreground">demonstrativos</strong>. Após a
                primeira sincronização, os jogos reais aparecerão aqui.
              </>
            ) : (
              <>
                Dados reais. Última sincronização:{" "}
                <strong className="text-foreground">
                  {lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "—"}
                </strong>
                .
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
              Visualizando como{" "}
              <strong className="text-foreground">
                {viewMode === "admin" ? "Admin Master" : "Usuário comum"}
              </strong>
            </div>
            {effectiveIsAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/sincronizacao">Sincronização</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            "oportunidade_analitica",
            "sem_oportunidade",
            "aguardar_dados",
            "sem_cobertura",
          ] as GameStatus[]
        ).map((s) => (
          <div
            key={s}
            className={`rounded-lg border p-3 ${STATUS_META[s].tone}`}
            title={STATUS_META[s].description}
          >
            <div className="text-[10px] uppercase tracking-widest opacity-80">
              {STATUS_META[s].label}
            </div>
            <div className="mt-1 text-2xl font-bold">{counts[s]}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por time ou competição"
            className="pl-9"
          />
        </div>
        <Select value={competition} onValueChange={setCompetition}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Competição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COMPETITIONS}>Todas as competições</SelectItem>
            {competitions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading && (
          <div className="flex items-center justify-center rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando jogos...
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum jogo corresponde ao filtro selecionado.
          </div>
        )}
        {items.map(({ g }) => (
          <div key={g.id}>
            <GameRow game={g} />
            {effectiveIsAdmin && (
              <div className="mt-1 rounded-md border border-dashed border-border/60 bg-background/30 p-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Visão Admin:</strong> {g.books.length}{" "}
                fonte(s), atualizado{" "}
                {g.updatedAt
                  ? new Date(g.updatedAt).toLocaleString("pt-BR")
                  : "—"}
                .
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
