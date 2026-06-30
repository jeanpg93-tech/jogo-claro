import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, EyeOff, Sparkles } from "lucide-react";
import { RULES, STATUS_META } from "@/lib/demo-games";

export const Route = createFileRoute("/metodologia")({
  head: () => ({
    meta: [
      { title: "Metodologia — Visão de Jogo" },
      {
        name: "description",
        content:
          "Como o Visão de Jogo classifica jogos de futebol pré-jogo: regras objetivas, transparentes e sem IA.",
      },
    ],
  }),
  component: MetodologiaPage,
});

function MetodologiaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Metodologia</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Esta página descreve, em linguagem simples, como o Visão de Jogo classifica
        cada jogo no painel. Nada aqui é palpite, recomendação ou promessa de
        resultado. Todas as classificações seguem regras objetivas, publicadas e
        idênticas para todos os usuários.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Escopo do MVP</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Futebol pré-jogo, mercado de vencedor da partida (Mandante / Empate / Visitante).</li>
          <li>Dados demonstrativos claramente identificados como “Demo”.</li>
          <li>Sem inteligência artificial nativa, sem chatbot, sem geração de palpites.</li>
          <li>Não exibimos links para casas de apostas. Não recebemos apostas.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Como uma odd vira “diferença vs referência”</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Para cada jogo coletamos uma <strong className="text-foreground">referência de mercado</strong> nas três
            possibilidades (M, E, V).
          </li>
          <li>
            Para cada possibilidade, calculamos a melhor odd disponível entre as fontes
            demonstrativas listadas.
          </li>
          <li>
            Convertemos cada odd em probabilidade implícita: <code className="rounded bg-muted px-1">1 / odd</code>.
          </li>
          <li>
            A diferença é apresentada em pontos percentuais (pp), comparando a probabilidade
            implícita da referência com a da melhor odd disponível. Diferença positiva = a odd
            disponível paga mais do que a referência.
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Limiares objetivos</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Card
            title="Diferença mínima"
            value={`${RULES.EDGE_THRESHOLD_PCT} pp`}
            description="Mínimo para classificar como “Oportunidade analítica”."
          />
          <Card
            title="Frescor dos dados"
            value={`${RULES.MAX_DATA_AGE_HOURS} horas`}
            description="Janela máxima desde a última atualização. Acima disso → “Aguardar dados”."
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Status possíveis</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <StatusBlock
            icon={<EyeOff className="h-4 w-4" />}
            label={STATUS_META.sem_cobertura.label}
            description={STATUS_META.sem_cobertura.description}
          />
          <StatusBlock
            icon={<AlertTriangle className="h-4 w-4" />}
            label={STATUS_META.aguardar_dados.label}
            description={STATUS_META.aguardar_dados.description}
          />
          <StatusBlock
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={STATUS_META.sem_oportunidade.label}
            description={STATUS_META.sem_oportunidade.description}
          />
          <StatusBlock
            icon={<Sparkles className="h-4 w-4" />}
            label={STATUS_META.oportunidade_analitica.label}
            description={STATUS_META.oportunidade_analitica.description}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">O que esta classificação não é</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Não é garantia de acerto, lucro ou retorno.</li>
          <li>Não é ordem para apostar. Apostar é decisão pessoal e responsabilidade do usuário.</li>
          <li>Não considera fatores subjetivos. Use o <Link to="/diario" className="text-primary hover:underline">diário pessoal</Link> para isso.</li>
          <li>Não envolve IA nativa do Lovable. Eventuais módulos de IA seriam externos e opt-in em fase futura.</li>
        </ul>
      </section>

      <div className="mt-10 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        Conteúdo destinado a maiores de 18 anos. Se apostar deixou de ser diversão,
        procure ajuda. Veja a página de{" "}
        <Link to="/jogo-responsavel" className="underline">
          jogo responsável
        </Link>
        .
      </div>
    </div>
  );
}

function Card({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function StatusBlock({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon} {label}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
