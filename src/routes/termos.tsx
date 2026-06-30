import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso Responsável — Visão de Jogo" }] }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <article className="prose-invert mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Termos de Uso Responsável</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

      <Section title="1. O que é o Visão de Jogo">
        O Visão de Jogo é uma plataforma de análise pré-jogo de futebol. Ajudamos usuários
        adultos a comparar informações disponíveis e a registrar suas próprias decisões. Não
        somos uma casa de apostas.
      </Section>
      <Section title="2. O que a plataforma não faz">
        Não recebemos apostas. Não processamos pagamentos de apostas. Não mantemos saldo. Não
        executamos apostas em nome de usuários. Não prometemos lucro, retorno garantido ou
        acerto.
      </Section>
      <Section title="3. Maioridade">
        O acesso é restrito a pessoas com 18 anos ou mais. Ao criar uma conta, o usuário
        declara cumprir esse requisito.
      </Section>
      <Section title="4. Conteúdo demonstrativo">
        Enquanto não houver integração com fontes externas de dados, todos os jogos, odds e
        estatísticas exibidos são exemplos demonstrativos, claramente identificados.
      </Section>
      <Section title="5. Responsabilidade do usuário">
        Decisões financeiras são de responsabilidade exclusiva do usuário. Resultados em
        futebol são imprevisíveis e nenhuma análise garante retorno.
      </Section>
      <Section title="6. Jogo responsável">
        Recomendamos limites pessoais, pausas e busca de ajuda quando necessário. Em caso de
        sofrimento associado ao jogo, consulte profissionais e organizações especializadas.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
