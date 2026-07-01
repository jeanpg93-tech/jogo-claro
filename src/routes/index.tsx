import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Cpu,
  ArrowRight,
  ScrollText,
  Scale,
  Landmark,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão de Jogo — Análise pré-jogo de futebol" },
      {
        name: "description",
        content:
          "Plataforma técnica de análise pré-jogo 1X2. Metodologia transparente, leitura assistida por IA e comparação de odds de várias casas. Não recebemos apostas.",
      },
      { property: "og:title", content: "Visão de Jogo" },
      {
        property: "og:description",
        content:
          "Análise pré-jogo, metodologia transparente e leitura assistida por IA. Plataforma 18+.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: BarChart3,
    tone: "primary" as const,
    title: "Regras Objetivas",
    desc: "Classificação transparente por critérios matemáticos: Oportunidade analítica, Sem oportunidade, Aguardar dados ou Sem cobertura.",
  },
  {
    icon: Cpu,
    tone: "accent" as const,
    title: "Leitura Assistida por IA",
    desc: "IA externa gera uma leitura auxiliar do jogo em modo direto ou detalhado — sempre com dados reais como base.",
  },
  {
    icon: Landmark,
    tone: "primary" as const,
    title: "Comparação Multi-Casa",
    desc: "Odds 1X2 de várias casas na mesma tela, com destaque BR para casas conhecidas no Brasil. Sem links de afiliados.",
  },
  {
    icon: BookOpen,
    tone: "accent" as const,
    title: "Diário Analítico",
    desc: "Registre suas leituras pré-jogo, o lado escolhido e a odd considerada. Histórico privado para acompanhar sua evolução.",
  },
  {
    icon: Scale,
    tone: "primary" as const,
    title: "Metodologia Aberta",
    desc: "Cada status é derivado de regras públicas descritas em detalhes. Nada de caixa-preta, nada de palpite disfarçado.",
  },
  {
    icon: ShieldCheck,
    tone: "accent" as const,
    title: "Responsabilidade 18+",
    desc: "Não recebemos apostas, não processamos pagamentos, não prometemos resultado. Conteúdo restrito a maiores de 18 anos.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Escolha o jogo",
    desc: "Filtre por competição no painel. Veja as principais odds de cada casa em uma linha compacta.",
  },
  {
    n: "02",
    title: "Leia o status objetivo",
    desc: "Cada jogo recebe uma classificação clara com base em regras públicas — nunca em opinião.",
  },
  {
    n: "03",
    title: "Registre sua decisão",
    desc: "Anote no diário pessoal. A plataforma organiza; a decisão final é sempre sua.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0f0d] font-['Barlow'] text-[#e2e8f0] selection:bg-[#22c55e] selection:text-[#0a0f0d]">
      <div className="mx-auto max-w-6xl space-y-24 px-6 py-16 md:py-20">
        {/* Hero */}
        <section className="relative flex flex-col items-center gap-12 md:flex-row">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#22c55e]/10 blur-[120px]"
          />

          <div className="relative z-10 flex-1">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#22c55e]/30 bg-[#111a16] px-3 py-1">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#a3e635]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#a3e635]">
                Análise pré-jogo profissional
              </span>
            </div>

            <h1 className="mb-6 font-['Bebas_Neue'] text-6xl leading-[0.9] text-white md:text-8xl lg:text-9xl">
              DOMINE A <span className="text-[#22c55e]">VISÃO</span>
              <br />
              DO JOGO
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-400 md:text-xl">
              Plataforma técnica de análise pré-jogo 1X2. Metodologia
              transparente, leitura assistida por IA e comparação de odds de
              várias casas — incluindo as brasileiras.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/auth/cadastro"
                className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#22c55e] px-6 py-3 font-bold uppercase tracking-tighter text-[#0a0f0d] transition-colors hover:bg-[#a3e635] md:px-8 md:py-4"
              >
                Criar conta grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/metodologia"
                className="inline-flex min-h-11 items-center rounded-sm border border-white/10 px-6 py-3 font-bold uppercase tracking-tighter text-white transition-colors hover:bg-white/5 md:px-8 md:py-4"
              >
                Ver metodologia
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Plataforma exclusiva para maiores de 18 anos. Não recebemos
              apostas, não processamos pagamentos e não garantimos resultados.
            </p>
          </div>

          {/* Floating game card */}
          <div className="relative z-10 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111a16] p-6 shadow-2xl md:w-[400px]">
            <div className="absolute right-4 top-4">
              <div className="rounded bg-[#22c55e] px-3 py-1 text-[10px] font-bold text-[#0a0f0d]">
                OPORTUNIDADE
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-b border-white/5 pb-4">
                <p className="text-xs uppercase text-slate-500">
                  Competição — exemplo demonstrativo
                </p>
                <h3 className="font-['Bebas_Neue'] text-3xl text-white">
                  Time A <span className="text-slate-500">vs</span> Time B
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <OddCell label="Mandante" value="2.15" highlight />
                <OddCell label="Empate" value="3.40" />
                <OddCell label="Visitante" value="3.10" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Diferença vs referência</span>
                  <span className="font-semibold text-[#22c55e]">+8.4 pp</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0a0f0d]">
                  <div className="h-full w-[72%] bg-[#22c55e]" />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4 text-[10px] uppercase tracking-widest text-slate-500">
                <span>3 casas comparadas</span>
                <span>Dados demonstrativos</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section>
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#a3e635]">
                O que você tem
              </span>
              <h2 className="mt-2 font-['Bebas_Neue'] text-4xl leading-none text-white md:text-5xl">
                Ferramentas de análise, não de aposta
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section>
          <div className="mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#a3e635]">
              Como funciona
            </span>
            <h2 className="mt-2 font-['Bebas_Neue'] text-4xl leading-none text-white md:text-5xl">
              Três passos, zero atalho
            </h2>
          </div>

          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-lg border border-white/5 bg-[#111a16] p-8"
              >
                <div className="font-['Bebas_Neue'] text-5xl text-[#22c55e]">
                  {s.n}
                </div>
                <h3 className="mt-3 font-['Bebas_Neue'] text-2xl tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {s.desc}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Status legend */}
        <section className="rounded-lg border border-white/5 bg-[#111a16] p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg">
              <span className="text-xs font-bold uppercase tracking-widest text-[#a3e635]">
                Classificação por regras
              </span>
              <h2 className="mt-2 font-['Bebas_Neue'] text-3xl leading-none text-white md:text-4xl">
                Quatro status. Sem palpite disfarçado.
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                Nenhum jogo é rotulado como “dica” ou “palpite certeiro”. Cada
                status descreve o que os dados mostram — e o que ainda falta.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatusBadge dot="#22c55e" label="Oportunidade analítica" />
              <StatusBadge dot="#94a3b8" label="Sem oportunidade" />
              <StatusBadge dot="#f59e0b" label="Aguardar dados" />
              <StatusBadge dot="#475569" label="Sem cobertura" />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden rounded-xl border border-[#22c55e]/20 bg-gradient-to-br from-[#111a16] to-[#0a0f0d] px-6 py-12 text-center md:px-12 md:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,#22c55e22,transparent_60%)]"
          />
          <div className="relative">
            <ScrollText className="mx-auto h-8 w-8 text-[#a3e635]" />
            <h2 className="mt-4 font-['Bebas_Neue'] text-4xl leading-none text-white md:text-6xl">
              Comece com método,
              <br />
              não com pressa
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Crie sua conta gratuita. Confirmação de maioridade obrigatória.
              Você continua no controle das suas decisões.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth/cadastro"
                className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#22c55e] px-8 py-4 font-bold uppercase tracking-tighter text-[#0a0f0d] transition-colors hover:bg-[#a3e635]"
              >
                Criar conta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/jogo-responsavel"
                className="inline-flex min-h-11 items-center rounded-sm border border-white/10 px-8 py-4 font-bold uppercase tracking-tighter text-white transition-colors hover:bg-white/5"
              >
                Jogo responsável
              </Link>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <div className="border-t border-white/5 pt-8 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Conteúdo analítico informativo · Proibido para menores de 18 anos ·
            Não recebemos apostas · Jogue com responsabilidade
          </p>
        </div>
      </div>
    </div>
  );
}

function OddCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded border border-white/5 bg-[#0a0f0d] p-3 text-center">
      <span className="block text-[10px] uppercase text-slate-500">{label}</span>
      <span
        className={`mt-1 block font-bold tabular-nums ${
          highlight ? "text-[#a3e635]" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  tone,
  title,
  desc,
}: {
  icon: typeof BarChart3;
  tone: "primary" | "accent";
  title: string;
  desc: string;
}) {
  const iconColor = tone === "primary" ? "text-[#22c55e]" : "text-[#a3e635]";
  const iconBg = tone === "primary" ? "bg-[#22c55e]/10" : "bg-[#a3e635]/10";
  return (
    <div className="group rounded-lg border border-white/5 bg-[#111a16] p-8 transition-all hover:border-[#22c55e]/50">
      <div
        className={`mb-6 flex h-12 w-12 items-center justify-center rounded ${iconBg}`}
      >
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <h4 className="mb-3 font-['Bebas_Neue'] text-2xl tracking-tight text-white">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function StatusBadge({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded border border-white/5 bg-[#0a0f0d] px-3 py-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot, boxShadow: `0 0 8px ${dot}` }}
      />
      <span className="text-xs font-bold uppercase tracking-widest text-slate-200">
        {label}
      </span>
    </div>
  );
}
