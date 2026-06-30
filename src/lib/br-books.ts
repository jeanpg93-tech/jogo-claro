// Casas com badge "BR" — destacadas no painel/detalhe.
// Inclui casas que aparecem na The Odds API (limitado) e casas reconhecidas
// pelo provedor OddsPapi (cobertura BR real: Betano, Bet365, KTO etc.).

const BR_BOOKS_RAW = [
  // Trazidas pelo OddsPapi (cobertura BR real)
  "Betano",
  "Betano BR",
  "bet365",
  "KTO",
  "Estrela Bet",
  "Stake BR",
  "Superbet BR",
  "Betnacional",
  "Sportingbet BR",
  "betboo BR",
  "Brazino777 BR",
  "PlayPix",
  // Globais que aceitam jogadores no Brasil (The Odds API)
  "1xBet",
  "Betfair Exchange",
  "Betsson",
  "Betway",
  "Unibet",
  "888sport",
  "William Hill",
  "Marathon Bet",
  "MarathonBet",
  "LeoVegas",
];

const BR_SET = new Set(BR_BOOKS_RAW.map((b) => b.toLowerCase()));

export function isBookBR(title: string): boolean {
  return BR_SET.has(title.toLowerCase());
}
