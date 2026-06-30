import { Link } from "@tanstack/react-router";
import { Eye, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const { isAdmin, viewMode, setViewMode } = useRole();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Eye className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight">
              Visão de Jogo
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Análise pré-jogo
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {user && (
            <Link to="/dashboard" className="hover:text-foreground">
              Painel
            </Link>
          )}
          <Link to="/jogo-responsavel" className="hover:text-foreground">
            Jogo responsável
          </Link>
          <Link to="/termos" className="hover:text-foreground">
            Termos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="hidden items-center overflow-hidden rounded-md border border-border bg-card text-xs sm:flex">
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
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
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
      </div>
    </header>
  );
}
