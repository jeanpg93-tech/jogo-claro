import type { OddsProvider } from "./types";
import { createTheOddsApiProvider } from "./the-odds-api.server";

// Seleciona o provedor pelo env ODDS_PROVIDER. Default: the-odds-api.
// Para trocar de provedor no futuro, basta adicionar outra entrada aqui.
export function getProvider(): OddsProvider {
  const name = (process.env.ODDS_PROVIDER ?? "the-odds-api").toLowerCase();
  switch (name) {
    case "the-odds-api":
      return createTheOddsApiProvider();
    default:
      throw new Error(`Provedor de odds desconhecido: ${name}`);
  }
}
