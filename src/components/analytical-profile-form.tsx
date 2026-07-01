import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useGames } from "@/lib/games-data";
import {
  DEFAULT_ANALYTICAL_PROFILE,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  MARKET_OPTIONS,
  RISK_OPTIONS,
  isProfileComplete,
  type AnalyticalProfile,
  type ExperienceLevel,
  type Goal,
  type RiskProfile,
} from "@/lib/analytical-profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface Props {
  /** Callback disparado quando o usuário salva o perfil com sucesso. */
  onSaved?: () => void;
  /** Mostra bloco de competições favoritas junto (opt-in). */
  showCompetitions?: boolean;
  /** Rótulo do botão de salvar. */
  submitLabel?: string;
}

export function AnalyticalProfileForm({
  onSaved,
  showCompetitions = false,
  submitLabel = "Salvar perfil analítico",
}: Props) {
  const { user } = useAuth();
  const { data: gamesData } = useGames();
  const competitions = useMemo<string[]>(
    () =>
      Array.from(new Set((gamesData?.games ?? []).map((g) => g.competition))).sort(),
    [gamesData],
  );

  const [profile, setProfile] = useState<AnalyticalProfile>(
    DEFAULT_ANALYTICAL_PROFILE,
  );
  const [favoriteCompetitions, setFavoriteCompetitions] = useState<string[]>([]);
  const [disclaimer, setDisclaimer] = useState(false);
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
          setProfile({
            experience_level: (data.experience_level as ExperienceLevel) ?? null,
            risk_profile: (data.risk_profile as RiskProfile) ?? null,
            goals: (data.goals as Goal[]) ?? [],
            markets: (data.markets as ("1x2")[]) ?? ["1x2"],
            risk_tolerance: data.risk_tolerance ?? 5,
            discipline_alerts: data.discipline_alerts ?? true,
            disclaimer_acknowledged_at: data.disclaimer_acknowledged_at ?? null,
            analytical_profile_completed_at:
              data.analytical_profile_completed_at ?? null,
          });
          setFavoriteCompetitions(data.favorite_competitions ?? []);
          setDisclaimer(Boolean(data.disclaimer_acknowledged_at));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function toggleGoal(g: Goal, checked: boolean) {
    setProfile((p) => ({
      ...p,
      goals: checked ? Array.from(new Set([...p.goals, g])) : p.goals.filter((x) => x !== g),
    }));
  }

  function toggleCompetition(name: string, checked: boolean) {
    setFavoriteCompetitions((c) =>
      checked ? Array.from(new Set([...c, name])) : c.filter((x) => x !== name),
    );
  }

  async function save() {
    if (!user) return;
    const next: AnalyticalProfile = {
      ...profile,
      disclaimer_acknowledged_at: disclaimer
        ? profile.disclaimer_acknowledged_at ?? new Date().toISOString()
        : null,
    };
    if (!isProfileComplete(next)) {
      toast.error("Preencha os campos obrigatórios e confirme o aviso final.");
      return;
    }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        experience_level: next.experience_level,
        risk_profile: next.risk_profile,
        goals: next.goals,
        markets: next.markets,
        risk_tolerance: next.risk_tolerance,
        discipline_alerts: next.discipline_alerts,
        disclaimer_acknowledged_at: next.disclaimer_acknowledged_at,
        analytical_profile_completed_at:
          next.analytical_profile_completed_at ?? nowIso,
        ...(showCompetitions ? { favorite_competitions: favoriteCompetitions } : {}),
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil analítico salvo.");
    setProfile((p) => ({
      ...p,
      analytical_profile_completed_at:
        p.analytical_profile_completed_at ?? nowIso,
      disclaimer_acknowledged_at: next.disclaimer_acknowledged_at,
    }));
    onSaved?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando seu perfil…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Nível de experiência */}
      <section>
        <Label className="text-base font-semibold">Nível de experiência</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuda a plataforma a calibrar o tom da análise e os alertas.
        </p>
        <RadioGroup
          className="mt-3 grid gap-2"
          value={profile.experience_level ?? ""}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, experience_level: v as ExperienceLevel }))
          }
        >
          {EXPERIENCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`exp-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <RadioGroupItem id={`exp-${opt.value}`} value={opt.value} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Perfil de risco */}
      <section>
        <Label className="text-base font-semibold">Perfil de risco</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Como você costuma se posicionar diante de cenários incertos.
        </p>
        <RadioGroup
          className="mt-3 grid gap-2 sm:grid-cols-2"
          value={profile.risk_profile ?? ""}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, risk_profile: v as RiskProfile }))
          }
        >
          {RISK_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`risk-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <RadioGroupItem id={`risk-${opt.value}`} value={opt.value} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Objetivos */}
      <section>
        <Label className="text-base font-semibold">Objetivos na plataforma</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Selecione um ou mais objetivos. Você pode ajustar depois.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((opt) => {
            const checked = profile.goals.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleGoal(opt.value, Boolean(v))}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Mercados */}
      <section>
        <Label className="text-base font-semibold">Mercados de interesse</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          No momento a plataforma cobre apenas o mercado 1X2.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MARKET_OPTIONS.map((opt) => {
            const checked = profile.markets.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60"
                data-disabled={!opt.available}
              >
                <Checkbox
                  checked={checked}
                  disabled={!opt.available}
                  onCheckedChange={(v) =>
                    setProfile((p) => ({
                      ...p,
                      markets: v
                        ? Array.from(new Set([...p.markets, opt.value]))
                        : p.markets.filter((x) => x !== opt.value),
                    }))
                  }
                />
                <span>
                  {opt.label}
                  {!opt.available && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (mais mercados em breve)
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Competições */}
      {showCompetitions && competitions.length > 0 && (
        <section>
          <Label className="text-base font-semibold">Competições de interesse</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Usadas para priorizar a organização visual do painel.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {competitions.map((c) => {
              const checked = favoriteCompetitions.includes(c);
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
        </section>
      )}

      {/* Tolerância a risco */}
      <section>
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Tolerância pessoal a risco</Label>
          <span className="text-sm font-semibold tabular-nums">
            {profile.risk_tolerance}/10
          </span>
        </div>
        <Slider
          className="mt-3"
          min={1}
          max={10}
          step={1}
          value={[profile.risk_tolerance]}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, risk_tolerance: v[0] ?? p.risk_tolerance }))
          }
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>Muito conservador</span>
          <span>Muito arrojado</span>
        </div>
      </section>

      {/* Alertas de disciplina */}
      <section className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-3 py-3">
        <div>
          <Label className="text-sm font-semibold">
            Receber alertas de cautela e disciplina
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Destaques que reforçam qualidade dos dados, riscos e decisões impulsivas.
          </p>
        </div>
        <Switch
          checked={profile.discipline_alerts}
          onCheckedChange={(v) =>
            setProfile((p) => ({ ...p, discipline_alerts: v }))
          }
        />
      </section>

      {/* Confirmação final */}
      <section className="rounded-md border border-border/60 bg-background/40 p-3 text-sm">
        <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
          <Checkbox
            className="mt-0.5"
            checked={disclaimer}
            onCheckedChange={(v) => setDisclaimer(Boolean(v))}
          />
          <span>
            Entendo que o Visão de Jogo <strong>não garante lucro</strong>,{" "}
            <strong>não executa apostas</strong> e{" "}
            <strong>não substitui a minha decisão</strong>. A plataforma é uma
            ferramenta de análise, transparência e disciplina.
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
