import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Phone, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/jogo-responsavel")({
  head: () => ({ meta: [{ title: "Jogo responsável — Visão de Jogo" }] }),
  component: JogoResponsavelPage,
});

function JogoResponsavelPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        18+ · Acesso restrito a adultos
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Jogo responsável</h1>
      <p className="mt-3 text-muted-foreground">
        O Visão de Jogo defende o uso consciente e disciplinado da análise esportiva.
        Apostar pode causar prejuízos financeiros e sofrimento emocional. Conheça os limites.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card icon={HeartHandshake} title="Sinais de alerta">
          Apostar mais do que pode perder, esconder o comportamento de pessoas próximas,
          tentar recuperar perdas com apostas maiores, sentir ansiedade ou irritação ao
          parar.
        </Card>
        <Card icon={LifeBuoy} title="Boas práticas">
          Defina limites de tempo e valor, faça pausas, evite decisões impulsivas, registre
          suas decisões no diário para enxergar padrões.
        </Card>
        <Card icon={Phone} title="Onde buscar ajuda">
          CVV — ligue 188, 24h, gratuito.{" "}
          <a className="text-primary underline" href="https://www.jogadoresanonimos.com.br" target="_blank" rel="noreferrer">
            Jogadores Anônimos
          </a>{" "}
          oferece grupos de apoio.
        </Card>
        <Card icon={HeartHandshake} title="Nosso compromisso">
          Não usamos linguagem que incentive comportamento impulsivo. Não recebemos apostas,
          não mostramos links para casas de apostas e não criamos ranking de ganhos.
        </Card>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
