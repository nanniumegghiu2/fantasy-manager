import { CLUBS_01 } from "./clubs-01";
import { CLUBS_02 } from "./clubs-02";
import { CLUBS_03 } from "./clubs-03";
import { CLUBS_04 } from "./clubs-04";
import type { SerieBClub } from "./types";

export * from "./types";

/** I venti club della Serie B 2025/26, nell'ordine alfabetico della fonte. */
export const SERIE_B_CLUBS: SerieBClub[] = [...CLUBS_01, ...CLUBS_02, ...CLUBS_03, ...CLUBS_04];
