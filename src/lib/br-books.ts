// Casas de aposta que operam/aceitam jogadores no Brasil.
// Os títulos vêm como string da The Odds API (campo `title` de cada bookmaker).
// Normalizamos para comparação case-insensitive.

const BR_BOOKS_RAW = [
  "Bet365",
  "Betano",
  "Betfair",
  "Betfair Exchange",
  "Unibet",
  "1xBet",
  "Betsson",
  "Marathon Bet",
  "MarathonBet",
  "Sportingbet",
  "Betway",
  "LeoVegas",
  "888sport",
  "William Hill",
];

const BR_SET = new Set(BR_BOOKS_RAW.map((b) => b.toLowerCase()));

export function isBookBR(title: string): boolean {
  return BR_SET.has(title.toLowerCase());
}
