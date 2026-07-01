import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#0a0f0d]">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#22c55e]/50 to-transparent" />

      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#22c55e]/30 bg-[#111a16] text-[#22c55e]">
                <Eye className="h-5 w-5" />
              </span>
              <div className="leading-none">
                <div className="font-['Bebas_Neue'] text-2xl tracking-wide text-white">
                  Visão de <span className="text-[#22c55e]">Jogo</span>
                </div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3e635]/80">
                  Análise pré-jogo
                </div>
              </div>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Plataforma técnica de análise pré-jogo. Não recebemos apostas, não
              processamos pagamentos e não garantimos resultados. Jogue com
              responsabilidade.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-sm border border-[#22c55e]/40 bg-[#111a16] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#a3e635]">
                18+
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Conteúdo analítico informativo
              </span>
            </div>
          </div>

          {/* Plataforma */}
          <FooterColumn title="Plataforma">
            <FooterLink to="/">Início</FooterLink>
            <FooterLink to="/metodologia">Metodologia</FooterLink>
            <FooterLink to="/jogo-responsavel">Jogo responsável</FooterLink>
          </FooterColumn>

          {/* Legal */}
          <FooterColumn title="Legal">
            <FooterLink to="/termos">Termos</FooterLink>
            <FooterLink to="/privacidade">Privacidade</FooterLink>
          </FooterColumn>
        </div>

        {/* Ajuda */}
        <div className="mt-10 rounded-sm border border-white/5 bg-[#111a16] p-5 text-xs leading-relaxed text-slate-400">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3e635]">
            Precisa de ajuda?
          </span>
          Ligue{" "}
          <span className="font-semibold text-white">188 (CVV)</span> ou acesse{" "}
          <a
            className="text-[#22c55e] underline-offset-4 hover:underline"
            href="https://www.jogadoresanonimos.com.br"
            target="_blank"
            rel="noreferrer"
          >
            Jogadores Anônimos
          </a>
          .
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/5 pt-6 text-[11px] uppercase tracking-widest text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Visão de Jogo</span>
          <span className="text-slate-600">
            Plataforma analítica · Não recebe apostas
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3e635]">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="text-sm font-medium text-slate-300 transition-colors hover:text-[#22c55e]"
    >
      {children}
    </Link>
  );
}
