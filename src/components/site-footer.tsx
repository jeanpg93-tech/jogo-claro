import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary">
                18+
              </span>
              <span className="font-display text-base font-semibold text-foreground">
                Visão de Jogo
              </span>
            </div>
            <p>
              Plataforma de análise pré-jogo. Não recebemos apostas, não processamos pagamentos
              de apostas e não garantimos resultados. Jogue com responsabilidade.
            </p>
            <p className="text-xs">
              Precisa de ajuda? Ligue 188 (CVV) ou acesse{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://www.jogadoresanonimos.com.br"
                target="_blank"
                rel="noreferrer"
              >
                Jogadores Anônimos
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-2">
              <div className="font-semibold text-foreground">Plataforma</div>
              <Link to="/" className="block hover:text-foreground">Início</Link>
              <Link to="/jogo-responsavel" className="block hover:text-foreground">
                Jogo responsável
              </Link>
            </div>
            <div className="space-y-2">
              <div className="font-semibold text-foreground">Legal</div>
              <Link to="/termos" className="block hover:text-foreground">Termos</Link>
              <Link to="/privacidade" className="block hover:text-foreground">Privacidade</Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6 text-xs">
          © {new Date().getFullYear()} Visão de Jogo · Conteúdo demonstrativo enquanto não há
          integração de dados reais.
        </div>
      </div>
    </footer>
  );
}
