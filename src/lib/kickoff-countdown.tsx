// Indicador "Faltam X dias" para o kickoff de um jogo.
// Mensagem extra quando o jogo ainda está distante e poucas casas cotaram.

export function getKickoffInfo(kickoff: string) {
  const now = Date.now();
  const target = new Date(kickoff).getTime();
  const diffMs = target - now;
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);
  return { diffMs, diffH, diffD };
}

export function kickoffLabel(kickoff: string): string {
  const { diffMs, diffH, diffD } = getKickoffInfo(kickoff);
  if (diffMs <= 0) return "Em andamento ou encerrado";
  if (diffH < 1) return "Começa em menos de 1h";
  if (diffH < 24) return `Faltam ~${diffH}h`;
  if (diffD === 1) return "Falta 1 dia";
  return `Faltam ${diffD} dias`;
}

export function KickoffCountdown({
  kickoff,
  books,
}: {
  kickoff: string;
  books?: number;
}) {
  const { diffMs, diffD } = getKickoffInfo(kickoff);
  if (diffMs <= 0) return null;
  const tone =
    diffD <= 1
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : diffD <= 3
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-border/60 bg-background/40 text-muted-foreground";
  const hint =
    books !== undefined && diffD > 3 && books < 5
      ? " · mais casas devem cotar conforme a data se aproxima"
      : "";
  return (
    <span
      className={`ml-1 rounded border px-1.5 py-0.5 text-[10px] ${tone}`}
      title={hint ? hint.slice(3) : undefined}
    >
      {kickoffLabel(kickoff)}
      {hint}
    </span>
  );
}
