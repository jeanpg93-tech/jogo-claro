import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_ANALYTICAL_PROFILE,
  isProfileComplete,
  type AnalyticalProfile,
  type ExperienceLevel,
  type Goal,
  type RiskProfile,
} from "@/lib/analytical-profile";

export interface AnalyticalProfileState {
  profile: AnalyticalProfile;
  loading: boolean;
  isComplete: boolean;
}

/**
 * Hook leve que carrega o perfil analítico do usuário logado.
 * Se não houver linha em user_preferences, devolve o default.
 * Nunca lança — se der erro, retorna o default (o app não pode quebrar
 * porque o usuário ainda não completou o perfil).
 */
export function useAnalyticalProfile(): AnalyticalProfileState {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AnalyticalProfile>(
    DEFAULT_ANALYTICAL_PROFILE,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(DEFAULT_ANALYTICAL_PROFILE);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("user_preferences")
      .select(
        "experience_level, risk_profile, goals, markets, risk_tolerance, discipline_alerts, disclaimer_acknowledged_at, analytical_profile_completed_at",
      )
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
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { profile, loading, isComplete: isProfileComplete(profile) };
}
