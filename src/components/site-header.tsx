import { Link } from "@tanstack/react-router";
import { Eye, ShieldCheck, User as UserIcon, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const { isAdmin, viewMode, setViewMode } = useRole();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0f0d]/85 backdrop-blur-md">
      {/* Neon accent bar */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#22c55e]/60 to-transparent" />

      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-4 md:h-20">
        {/* Brand */}
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#22c55e]/30 bg-[#111a16] text-[#22c55e] md:h-10 md:w-10">
            <Eye className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-none">
            <div className="truncate font-['Bebas_Neue'] text-2xl tracking-wide text-white md:text-3xl">
              Visão de <span className="text-[#22c55e]">Jogo</span>
            </div>
            <div className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3e635]/80 sm:block">
              Análise pré-jogo
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-[13px] font-bold uppercase tracking-widest md:flex">
          {user && (
            <>
              <DesktopLink to="/dashboard">Painel</DesktopLink>
              <DesktopLink to="/diario">Diário</DesktopLink>
            </>
          )}
          <DesktopLink to="/metodologia">Metodologia</DesktopLink>
          <DesktopLink to="/jogo-responsavel">Jogo responsável</DesktopLink>
        </nav>

        {/* Desktop actions */}
        <div className="col-start-3 hidden items-center gap-2 md:flex">
          {isAdmin && (
            <div className="flex items-center overflow-hidden rounded-sm border border-white/10 bg-[#111a16] text-[10px] font-bold uppercase tracking-widest">
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  viewMode === "admin"
                    ? "bg-[#22c55e] text-[#0a0f0d]"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Visualizar como Admin Master"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </button>
              <button
                type="button"
                onClick={() => setViewMode("user")}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  viewMode === "user"
                    ? "bg-[#22c55e] text-[#0a0f0d]"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Visualizar como Usuário comum"
              >
                <UserIcon className="h-3.5 w-3.5" /> Usuário
              </button>
            </div>
          )}
          <span className="rounded-sm border border-[#22c55e]/40 bg-[#111a16] px-2 py-1 text-[10px] font-bold tracking-widest text-[#a3e635]">
            18+
          </span>
          {user ? (
            <>
              <Link
                to="/perfil"
                className="inline-flex min-h-9 items-center rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 transition-colors hover:text-white"
              >
                Perfil
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex min-h-9 items-center rounded-sm border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/5"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth/entrar"
                className="inline-flex min-h-9 items-center rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 transition-colors hover:text-white"
              >
                Entrar
              </Link>
              <Link
                to="/auth/cadastro"
                className="inline-flex min-h-9 items-center rounded-sm bg-[#22c55e] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#0a0f0d] transition-colors hover:bg-[#a3e635]"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>

        {/* Mobile: 18+ + hamburger */}
        <div className="col-start-2 flex items-center gap-2 md:hidden">
          <span className="rounded-sm border border-[#22c55e]/40 bg-[#111a16] px-2 py-1 text-[10px] font-bold tracking-widest text-[#a3e635]">
            18+
          </span>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Abrir menu"
                className="h-11 w-11 rounded-sm border-white/10 bg-[#111a16] text-white hover:bg-white/5 hover:text-white"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[85vw] max-w-sm overflow-y-auto border-l border-white/5 bg-[#0a0f0d] text-slate-200"
            >
              <SheetHeader>
                <SheetTitle className="text-left font-['Bebas_Neue'] text-3xl tracking-wide text-white">
                  Visão de <span className="text-[#22c55e]">Jogo</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-1">
                {user && (
                  <>
                    <MobileLink to="/dashboard" onClick={close}>
                      Painel
                    </MobileLink>
                    <MobileLink to="/diario" onClick={close}>
                      Diário
                    </MobileLink>
                    <MobileLink to="/perfil" onClick={close}>
                      Perfil
                    </MobileLink>
                  </>
                )}
                <MobileLink to="/metodologia" onClick={close}>
                  Metodologia
                </MobileLink>
                <MobileLink to="/jogo-responsavel" onClick={close}>
                  Jogo responsável
                </MobileLink>
              </nav>

              {isAdmin && (
                <div className="mt-6">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3e635]/80">
                    Visualizar como
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("admin")}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                        viewMode === "admin"
                          ? "border-[#22c55e] bg-[#22c55e] text-[#0a0f0d]"
                          : "border-white/10 bg-[#111a16] text-slate-400"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("user")}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                        viewMode === "user"
                          ? "border-[#22c55e] bg-[#22c55e] text-[#0a0f0d]"
                          : "border-white/10 bg-[#111a16] text-slate-400"
                      }`}
                    >
                      <UserIcon className="h-4 w-4" /> Usuário
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                {user ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/10 bg-[#111a16] px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/5"
                    onClick={() => {
                      close();
                      signOut();
                    }}
                  >
                    Sair
                  </button>
                ) : (
                  <>
                    <Link
                      to="/auth/entrar"
                      onClick={close}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/10 bg-[#111a16] px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/5"
                    >
                      Entrar
                    </Link>
                    <Link
                      to="/auth/cadastro"
                      onClick={close}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#22c55e] px-4 py-2 text-sm font-bold uppercase tracking-widest text-[#0a0f0d] transition-colors hover:bg-[#a3e635]"
                    >
                      Criar conta
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function DesktopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="relative inline-flex min-h-9 items-center rounded-sm px-3 py-1.5 text-slate-400 transition-colors hover:text-white"
      activeProps={{ className: "text-white" }}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex min-h-11 items-center rounded-sm border border-transparent px-3 py-2 text-sm font-bold uppercase tracking-widest text-slate-300 transition-colors hover:border-[#22c55e]/30 hover:bg-[#111a16] hover:text-white"
    >
      {children}
    </Link>
  );
}
