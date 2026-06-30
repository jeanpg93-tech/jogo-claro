// Casas listadas pela The Odds API que operam/aceitam jogadores no Brasil.
// IMPORTANTE: Betano, Bet365 (internacional), KTO, Pixbet, Esportes da Sorte,
// Superbet, Galera.bet, Estrela Bet e demais casas exclusivamente brasileiras
// NÃO estão disponíveis em nenhuma API genérica de odds — incluindo a
// The Odds API. Por isso não aparecem mesmo quando têm cotações no site.

const BR_BOOKS_RAW = [
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
