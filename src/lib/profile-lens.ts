// Leitura por perfil (Fase 2) — regras objetivas, sem IA.
// Combina o status objetivo do jogo (classifyGame) com o perfil analítico do
// usuário para gerar um destaque textual curto. Nunca diz "aposte" ou
// "não aposte"; nunca promete resultado. Se o perfil ainda não estiver
// completo, devolve null (nenhum destaque personalizado).

import type { AnalyticalProfile } from "@/lib/analytical-profile";
import type { GameStatus } from "@/lib/demo-games";

export type LensTone =
  | "neutral" // sem cor forte
  | "wait" // âmbar — aguardar dados
  | "match" // esmeralda — combina com o perfil
  | "caution" // amarelo — exige cautela
  | "off"; // cinza — não compatível com o perfil atual

export interface ProfileLens {
  label: string;
  description: string;
  tone: LensTone;
}

const TONE_CLASS: Record<LensTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  wait: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  match: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  caution: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  off: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

export function lensTone(tone: LensTone): string {
  return TONE_CLASS[tone];
}

/** Devolve a leitura para o perfil, ou null se o perfil não estiver completo. */
export function profileLens(
  status: GameStatus,
  profile: AnalyticalProfile,
  opts?: { edgePct?: number | null },
): ProfileLens | null {
  if (!profile.analytical_profile_completed_at) return null;

  const risk = profile.risk_profile;
  const disciplineOn = profile.discipline_alerts;
  const edge = opts?.edgePct ?? null;

  // Dados insuficientes ou desatualizados — reforça disciplina.
  if (status === "sem_cobertura" || status === "aguardar_dados") {
    return {
      label: "Melhor aguardar dados",
      description: disciplineOn
        ? "Sem informação suficiente para uma leitura confiável. Evite decisões impulsivas."
        : "Ainda não há dados suficientes para uma leitura por perfil.",
      tone: "wait",
    };
  }

  if (status === "sem_oportunidade") {
    if (risk === "conservador") {
      return {
        label: "Adequado ao seu perfil de cautela",
        description:
          "Sem diferença relevante frente à referência. Coerente com um perfil conservador manter observação.",
        tone: "match",
      };
    }
    if (risk === "oportunista") {
      return {
        label: "Sem oportunidade destacada",
        description:
          "Não há diferença relevante frente à referência agora. Perfis oportunistas costumam preferir aguardar.",
        tone: "off",
      };
    }
    return {
      label: "Sem oportunidade destacada",
      description: "Sem diferença relevante frente à referência disponível.",
      tone: "neutral",
    };
  }

  // oportunidade_analitica
  if (risk === "conservador") {
    return {
      label: "Exige cautela adicional",
      description:
        "Há diferença relevante frente à referência, mas o perfil conservador pede confirmação com dados adicionais.",
      tone: "caution",
    };
  }
  if (risk === "equilibrado") {
    return {
      label: "Compatível com seu perfil equilibrado",
      description:
        "Cenário com diferença relevante e dados suficientes. Pondere risco e registre no diário.",
      tone: "match",
    };
  }
  if (risk === "agressivo") {
    const extra =
      edge !== null && edge >= 10
        ? " Diferença acima da média — risco elevado; leia com atenção."
        : "";
    return {
      label: "Cenário compatível com maior tolerância a risco",
      description:
        "Oportunidade analítica identificada." + extra +
        " Registre sua decisão no diário para revisar depois.",
      tone: "match",
    };
  }
  if (risk === "oportunista") {
    return {
      label: "Diferença relevante frente à referência",
      description:
        "Alinhado ao seu perfil oportunista. Considere qualidade dos dados antes de decidir.",
      tone: "match",
    };
  }

  return {
    label: "Oportunidade analítica",
    description: "Diferença relevante identificada nos dados disponíveis.",
    tone: "neutral",
  };
}
