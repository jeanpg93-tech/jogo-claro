import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [{ title: "Perfil — Visão de Jogo" }],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const meta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    birth_date?: string;
    terms_accepted_at?: string;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Seu perfil</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informações da sua conta. Preferências e jogos chegam nas próximas fases.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
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

      <div className="mt-8 rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        <strong className="font-semibold text-foreground">Próximas fases:</strong> painel de
        jogos com status analítico, diário pessoal de decisões e preferências de competições
        favoritas. Tudo seguindo o princípio de transparência e regras objetivas — sem IA e sem
        recomendação de aposta.
      </div>
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
