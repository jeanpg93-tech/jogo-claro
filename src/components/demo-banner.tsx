import { Info } from "lucide-react";
import { useGames } from "@/lib/games-data";

export function DemoBanner() {
  const { data } = useGames();
  // Só exibe quando ainda não há dados reais sincronizados.
  if (data && !data.usingDemo) return null;

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 text-amber-200">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">Dados demonstrativos.</strong> A plataforma ainda
          não recebeu a primeira sincronização de dados externos.
        </span>
      </div>
    </div>
  );
}
