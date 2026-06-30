import type { OddsProvider } from "./types";
import { createTheOddsApiProvider } from "./the-odds-api.server";
import { createOddsPapiProvider, type OddsPapiOptions } from "./oddspapi.server";

// Provedores disponíveis. Cada um pode ser ligado/desligado de forma independente.
export type ProviderName = "the-odds-api" | "oddspapi";

export interface EnabledProvider {
  name: ProviderName;
  provider: OddsProvider;
}

export function getTheOddsApi(): OddsProvider {
  return createTheOddsApiProvider();
}

export function getOddsPapi(opts: OddsPapiOptions): OddsProvider {
  return createOddsPapiProvider(opts);
}

// Mantido por compatibilidade — usado se nada estiver configurado.
export function getProvider(): OddsProvider {
  const name = (process.env.ODDS_PROVIDER ?? "the-odds-api").toLowerCase();
  switch (name) {
    case "oddspapi":
      return createOddsPapiProvider({});
    case "the-odds-api":
    default:
      return createTheOddsApiProvider();
  }
}
