import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Visão de Jogo" }] }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().toLocaleDateString("pt-BR")}
      </p>

      <div className="mt-8 space-y-6 text-muted-foreground">
        <p>
          Coletamos apenas as informações necessárias para autenticação e funcionamento da
          plataforma: nome, e-mail, data de nascimento e registros que o próprio usuário cria
          em seu diário.
        </p>
        <p>
          Os dados de autenticação são armazenados em um projeto Supabase externo controlado
          pela operação do Visão de Jogo. Não vendemos nem compartilhamos seus dados com
          terceiros para fins de marketing.
        </p>
        <p>
          O usuário pode solicitar a exclusão de sua conta e dos dados associados a qualquer
          momento entrando em contato pelos canais oficiais.
        </p>
      </div>
    </article>
  );
}
