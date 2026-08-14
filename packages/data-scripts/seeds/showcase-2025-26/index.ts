import { ARABIA_SAUDITA } from "./arabia-saudita";
import { ARGENTINA } from "./argentina";
import { BRASILE } from "./brasile";
import { PAESI_BASSI } from "./paesi-bassi";
import { PORTOGALLO } from "./portogallo";
import { TURCHIA } from "./turchia";
import type { ShowcaseLeague } from "./types";

export * from "./types";

/**
 * **Le leghe vetrina importate.**
 *
 * Ogni nome qui dentro **deve** comparire in `SHOWCASE_LEAGUES` (`divisions.ts`): è quello, e
 * non questo elenco, a rendere una lega non giocabile. Il controllo è nell'importer, perché
 * dimenticarsene renderebbe il Flamengo una carriera selezionabile senza che nulla protesti.
 */
export const SHOWCASE_LEAGUES_DATA: ShowcaseLeague[] = [
  PORTOGALLO,
  PAESI_BASSI,
  TURCHIA,
  BRASILE,
  ARGENTINA,
  ARABIA_SAUDITA,
];

/**
 * **Prestigio calcistico della nazionalità** (1-5), stessa scala e stessi valori degli import
 * precedenti — alimenta il valore di mercato (§2.3).
 *
 * L'elenco è volutamente **corto**: chi non compare vale 3, cioè la media. Aggiungere qui una
 * nazione significa dichiarare che i suoi giocatori costano di più *a parità di Overall*, e non
 * è una cosa da fare per simpatia.
 */
export const NATION_PRESTIGE: Record<string, number> = {
  Brasile: 5,
  Francia: 5,
  Argentina: 5,
  Germania: 5,
  Spagna: 5,
  Italia: 5,
  Inghilterra: 5,
  Portogallo: 4,
  "Paesi Bassi": 4,
  Belgio: 4,
  Uruguay: 4,
  Croazia: 4,
};
