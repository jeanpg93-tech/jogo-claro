import { Eye } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-2 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <Eye className="relative h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <div className="font-display text-base font-semibold tracking-tight">
          Carregando
        </div>
        <div className="text-xs text-muted-foreground">
          Preparando sua visão de jogo…
        </div>
      </div>
    </div>
  );
}
