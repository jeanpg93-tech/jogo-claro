import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Eye,
  ShieldCheck,
  LineChart,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão de Jogo — Veja o jogo com mais clareza" },
      {
        name: "description",
        content:
          "Compare informações, acompanhe o mercado e tome decisões com mais disciplina. Plataforma de análise pré-jogo de futebol.",
      },
      { property: "og:title", content: "Visão de Jogo" },
      {
        property: "og:description",
        content: "Análise pré-jogo, transparência e disciplina. Não recebemos apostas.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.74_0.16_158/0.15),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Análise pré-jogo de futebol
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              Veja o jogo com <span className="text-primary">mais clareza.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Compare informações, acompanhe o mercado e tome decisões com mais disciplina.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth/cadastro">Criar conta</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth/entrar">Já tenho conta</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Plataforma exclusiva para maiores de 18 anos. Não recebemos apostas, não
              processamos pagamentos de apostas e não garantimos resultados.
            </p>
          </div>
        </div>
      </section>

      {/* O que é */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: "Dados sob a mesma régua",
              desc: "Visualize odd observada, referência de mercado e diferença percentual lado a lado.",
            },
            {
              icon: ShieldCheck,
              title: "Transparência sobre riscos",
              desc: "Mostramos o que sabemos, o que está incompleto e os limites da análise.",
            },
            {
              icon: ListChecks,
              title: "Disciplina nas decisões",
              desc: "Registre suas próprias escolhas e acompanhe seu histórico ao longo do tempo.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border/60 bg-card p-6"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
            <p className="mt-3 text-muted-foreground">
              Uma jornada simples para analisar jogos com mais consciência.
            </p>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: "Compare as informações do jogo", desc: "Times, competição, odd observada e referência de mercado em uma única tela." },
              { n: "02", title: "Entenda o status da análise", desc: "Sem cobertura, Aguardar dados, Sem oportunidade ou Oportunidade analítica." },
              { n: "03", title: "Registre sua decisão e acompanhe", desc: "Anote no diário pessoal e visualize sua evolução ao longo do tempo." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-border/60 bg-background p-6">
                <div className="font-display text-3xl font-bold text-primary">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Transparência */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Transparência total
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Nenhuma análise garante retorno
            </h2>
            <p className="mt-4 text-muted-foreground">
              Odds variam ao longo do tempo. Resultados em futebol são imprevisíveis. O Visão
              de Jogo organiza informações disponíveis e sinaliza quando os dados não são
              suficientes — mas nunca promete acerto.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex gap-3"><LineChart className="h-5 w-5 shrink-0 text-primary" /> Mostramos data e horário da última atualização.</li>
              <li className="flex gap-3"><Eye className="h-5 w-5 shrink-0 text-primary" /> Indicamos a qualidade dos dados e o status das escalações.</li>
              <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> Não recebemos apostas e não executamos apostas.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Exemplo demonstrativo
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="font-display text-xl font-semibold">Time A × Time B</div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Oportunidade analítica
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Odd observada", value: "2,10" },
                { label: "Referência", value: "1,92" },
                { label: "Diferença", value: "+9,4%" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.label}
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Atualizado há 4 min · 3 fontes · Escalações confirmadas — dados demonstrativos.
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Comece a acompanhar seus jogos com mais método
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Crie sua conta gratuita. Confirmação de maioridade obrigatória.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth/cadastro">Criar conta</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/jogo-responsavel">Jogo responsável</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
