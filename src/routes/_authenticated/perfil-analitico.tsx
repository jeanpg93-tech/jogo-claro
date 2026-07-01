import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalyticalProfileForm } from "@/components/analytical-profile-form";

export const Route = createFileRoute("/_authenticated/perfil-analitico")({
  head: () => ({
    meta: [{ title: "Complete seu perfil analítico — Visão de Jogo" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Complete seu perfil analítico
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Antes de abrir o painel, conte um pouco sobre como você acompanha jogos e
        mercados. Isso ajuda a plataforma a organizar destaques, alertas e riscos
        de forma mais adequada ao seu contexto. Você pode editar tudo depois em{" "}
        <strong>Perfil</strong>.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Lembrete: o Visão de Jogo é uma ferramenta de análise e disciplina. Não
        garante lucro, não executa apostas e não substitui a sua decisão.
      </p>

      <div className="mt-8 rounded-2xl border border-border/60 bg-card p-5 md:p-6">
        <AnalyticalProfileForm
          submitLabel="Salvar e continuar"
          onSaved={() => navigate({ to: "/dashboard" })}
        />
      </div>
    </div>
  );
}
