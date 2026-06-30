import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RULES } from "@/lib/demo-games";
import { useGames } from "@/lib/games-data";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Visão de Jogo" }] }),
  component: PerfilPage,
});

interface Preferences {
  favorite_competitions: string[];
  personal_edge_threshold: number;
  notify_oportunidade: boolean;
}

const DEFAULT_PREFS: Preferences = {
  favorite_competitions: [],
  personal_edge_threshold: RULES.EDGE_THRESHOLD_PCT,
  notify_oportunidade: true,
};

function PerfilPage() {
  const { user } = useAuth();
  const meta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    birth_date?: string;
    terms_accepted_at?: string;
  };

  const competitions = useMemo(
    () => Array.from(new Set(DEMO_GAMES.map((g) => g.competition))).sort(),
    [],
  );

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) {
          setPrefs({
            favorite_competitions: data.favorite_competitions ?? [],
            personal_edge_threshold:
              data.personal_edge_threshold ?? RULES.EDGE_THRESHOLD_PCT,
            notify_oportunidade: data.notify_oportunidade ?? true,
          });
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function toggleCompetition(name: string, checked: boolean) {
    setPrefs((p) => ({
      ...p,
      favorite_competitions: checked
        ? Array.from(new Set([...p.favorite_competitions, name]))
        : p.favorite_competitions.filter((c) => c !== name),
    }));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          favorite_competitions: prefs.favorite_competitions,
          personal_edge_threshold: prefs.personal_edge_threshold,
          notify_oportunidade: prefs.notify_oportunidade,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferências salvas.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Seu perfil</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informações da sua conta e preferências pessoais para o painel de análise.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Conta</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <InfoCard label="Nome" value={meta.full_name ?? "—"} />
          <InfoCard label="E-mail" value={user?.email ?? "—"} />
          <InfoCard
            label="Data de nascimento"
            value={meta.birth_date ? new Date(meta.birth_date).toLocaleDateString("pt-BR") : "—"}
          />
          <InfoCard
            label="Termos aceitos em"
            value={
              meta.terms_accepted_at
                ? new Date(meta.terms_accepted_at).toLocaleString("pt-BR")
                : "—"
            }
          />
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Preferências</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Estas preferências são pessoais e não alteram a classificação oficial do painel
          (que segue a metodologia pública).
        </p>

        <div className="mt-5">
          <Label>Competições favoritas</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {competitions.map((c) => {
              const checked = prefs.favorite_competitions.includes(c);
              return (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleCompetition(c, Boolean(v))}
                  />
                  <span>{c}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <Label>Limiar pessoal de diferença</Label>
            <span className="text-sm font-semibold tabular-nums">
              {prefs.personal_edge_threshold.toFixed(1)} pp
            </span>
          </div>
          <Slider
            min={1}
            max={15}
            step={0.5}
            value={[prefs.personal_edge_threshold]}
            onValueChange={(v) =>
              setPrefs((p) => ({ ...p, personal_edge_threshold: v[0] ?? p.personal_edge_threshold }))
            }
            className="mt-3"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Referência objetiva do sistema: {RULES.EDGE_THRESHOLD_PCT} pp. Este valor é só seu
            e serve para destacar visualmente jogos no seu diário pessoal.
          </p>
        </div>

        <div className="mt-6 flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-3 py-3">
          <div>
            <Label className="text-sm">Destacar “Oportunidade analítica”</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sinaliza visualmente os jogos classificados como oportunidade analítica.
            </p>
          </div>
          <Switch
            checked={prefs.notify_oportunidade}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, notify_oportunidade: v }))}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar preferências
          </Button>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-medium">{value}</div>
    </div>
  );
}
