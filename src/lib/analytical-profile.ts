// Constantes do Perfil Analítico do Usuário (Fase 1).
// Linguagem do produto: análise, disciplina, risco, decisão do usuário,
// oportunidade analítica. Nunca usar "aposta certa", "sinal", "green",
// "lucro garantido", "palpite infalível" ou similares.

export type ExperienceLevel = "iniciante" | "intermediario" | "avancado";
export type RiskProfile =
  | "conservador"
  | "equilibrado"
  | "agressivo"
  | "oportunista";
export type Goal =
  | "aprender"
  | "registrar_decisoes"
  | "comparar_odds"
  | "buscar_oportunidades"
  | "melhorar_disciplina";
export type Market = "1x2";

export interface AnalyticalProfile {
  experience_level: ExperienceLevel | null;
  risk_profile: RiskProfile | null;
  goals: Goal[];
  markets: Market[];
  risk_tolerance: number; // 1..10
  discipline_alerts: boolean;
  disclaimer_acknowledged_at: string | null;
  analytical_profile_completed_at: string | null;
}

export const DEFAULT_ANALYTICAL_PROFILE: AnalyticalProfile = {
  experience_level: null,
  risk_profile: null,
  goals: [],
  markets: ["1x2"],
  risk_tolerance: 5,
  discipline_alerts: true,
  disclaimer_acknowledged_at: null,
  analytical_profile_completed_at: null,
};

export const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "iniciante",
    label: "Iniciante",
    description: "Estou começando a acompanhar análises e mercados esportivos.",
  },
  {
    value: "intermediario",
    label: "Intermediário",
    description: "Já entendo odds, referência de mercado e leio análises regularmente.",
  },
  {
    value: "avancado",
    label: "Avançado",
    description: "Acompanho múltiplas fontes, comparo odds e uso metodologia própria.",
  },
];

export const RISK_OPTIONS: {
  value: RiskProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "conservador",
    label: "Conservador",
    description: "Prefiro cenários com dados sólidos e menor volatilidade.",
  },
  {
    value: "equilibrado",
    label: "Equilibrado",
    description: "Aceito risco moderado quando os dados são suficientes.",
  },
  {
    value: "agressivo",
    label: "Agressivo",
    description: "Considero cenários mais voláteis, ciente do risco elevado.",
  },
  {
    value: "oportunista",
    label: "Oportunista",
    description: "Busco diferenças relevantes entre odds e referência de mercado.",
  },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "aprender", label: "Aprender sobre análise pré-jogo" },
  { value: "registrar_decisoes", label: "Registrar minhas decisões no diário" },
  { value: "comparar_odds", label: "Comparar odds entre casas" },
  { value: "buscar_oportunidades", label: "Buscar oportunidades analíticas" },
  { value: "melhorar_disciplina", label: "Melhorar minha disciplina" },
];

export const MARKET_OPTIONS: {
  value: Market;
  label: string;
  available: boolean;
}[] = [
  { value: "1x2", label: "Resultado final (1X2)", available: true },
];

export function isProfileComplete(p: AnalyticalProfile): boolean {
  return Boolean(
    p.experience_level &&
      p.risk_profile &&
      p.goals.length > 0 &&
      p.markets.length > 0 &&
      p.disclaimer_acknowledged_at,
  );
}
