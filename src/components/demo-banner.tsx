import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 text-amber-200">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">Dados demonstrativos.</strong> A plataforma ainda não
          está integrada a fontes externas de jogos, odds ou escalações.
        </span>
      </div>
    </div>
  );
}
