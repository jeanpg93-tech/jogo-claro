// Mapeia nome da casa de apostas para o domínio usado pelo Logo.dev.
// Uso APENAS informativo (logo pequeno ao lado do nome). Sem link clicável.

const BOOK_TO_DOMAIN: Record<string, string> = {
  // Cobertura BR
  "betano": "betano.com",
  "betano br": "betano.com",
  "bet365": "bet365.com",
  "kto": "kto.com",
  "estrela bet": "estrelabet.com",
  "estrelabet": "estrelabet.com",
  "stake": "stake.com",
  "stake br": "stake.com",
  "superbet": "superbet.com",
  "superbet br": "superbet.com",
  "betnacional": "betnacional.com",
  "sportingbet": "sportingbet.com",
  "sportingbet br": "sportingbet.com",
  "betboo": "betboo.com",
  "betboo br": "betboo.com",
  "brazino777": "brazino777.com",
  "brazino777 br": "brazino777.com",
  "playpix": "playpix.com",
  "novibet": "novibet.com",
  "betboom": "betboom.com",
  "sorte online": "sorteonline.com.br",
  "onabet": "onabet.com",
  "galera.bet": "galera.bet",
  "galera bet": "galera.bet",
  "pinnacle": "pinnacle.com",
  // Globais
  "1xbet": "1xbet.com",
  "betfair": "betfair.com",
  "betfair exchange": "betfair.com",
  "betsson": "betsson.com",
  "betway": "betway.com",
  "unibet": "unibet.com",
  "888sport": "888sport.com",
  "william hill": "williamhill.com",
  "marathon bet": "marathonbet.com",
  "marathonbet": "marathonbet.com",
  "leovegas": "leovegas.com",
  "draftkings": "draftkings.com",
  "fanduel": "fanduel.com",
  "caesars": "caesars.com",
  "bovada": "bovada.lv",
  "mybookie.ag": "mybookie.ag",
  "betrivers": "betrivers.com",
  "betonlineag": "betonline.ag",
  "lowvig.ag": "lowvig.ag",
  "gtbets": "gtbets.eu",
  "wynnbet": "wynnbet.com",
  "pointsbetus": "pointsbet.com",
  "pointsbet": "pointsbet.com",
};

const PUBLISHABLE_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY as
  | string
  | undefined;

/** Retorna URL do logo (Logo.dev) ou null se não houver domínio mapeado / chave. */
export function bookLogoUrl(bookName: string, size = 32): string | null {
  if (!PUBLISHABLE_KEY) return null;
  const domain = BOOK_TO_DOMAIN[bookName.trim().toLowerCase()];
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=${PUBLISHABLE_KEY}&size=${size}&format=png`;
}
