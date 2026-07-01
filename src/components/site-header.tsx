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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Eye className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              Visão de Jogo
            </div>
            <div className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
              Análise pré-jogo
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {user && (
            <>
              <Link to="/dashboard" className="hover:text-foreground">
                Painel
              </Link>
              <Link to="/diario" className="hover:text-foreground">
                Diário
              </Link>
            </>
          )}
          <Link to="/metodologia" className="hover:text-foreground">
            Metodologia
          </Link>
          <Link to="/jogo-responsavel" className="hover:text-foreground">
            Jogo responsável
          </Link>
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          {isAdmin && (
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-card text-xs">
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                  viewMode === "admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualizar como Admin Master"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </button>
              <button
                type="button"
                onClick={() => setViewMode("user")}
                className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                  viewMode === "user"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualizar como Usuário comum"
              >
                <UserIcon className="h-3.5 w-3.5" /> Usuário
              </button>
            </div>
          )}
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            18+
          </span>
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/perfil">Perfil</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth/entrar">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth/cadastro">Criar conta</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile: 18+ + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            18+
          </span>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Abrir menu"
                className="h-11 w-11"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-1 text-base">
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
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Visualizar como
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("admin")}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                        viewMode === "admin"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("user")}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                        viewMode === "user"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <UserIcon className="h-4 w-4" /> Usuário
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                {user ? (
                  <Button
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => {
                      close();
                      signOut();
                    }}
                  >
                    Sair
                  </Button>
                ) : (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 w-full"
                      onClick={close}
                    >
                      <Link to="/auth/entrar">Entrar</Link>
                    </Button>
                    <Button asChild className="min-h-11 w-full" onClick={close}>
                      <Link to="/auth/cadastro">Criar conta</Link>
                    </Button>
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
      className="flex min-h-11 items-center rounded-md px-3 py-2 text-foreground hover:bg-accent"
    >
      {children}
    </Link>
  );
}
