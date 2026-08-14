import { describe, expect, it } from "vitest";
import {
  FABBISOGNO_PER_REPARTO,
  evolveWorld,
  planWorldTransfers,
  type WorldClub,
  type WorldPlayer,
  type WorldTransfer,
} from "../ds/aiWorld";
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";

/**
 * **Il realismo del mercato delle squadre del computer.**
 *
 * Segnalazione dell'utente: *"in una stagione una squadra ha venduto i suoi migliori attaccanti
 * senza acquistare ricambi, azioni che nel mondo reale non hanno senso"*.
 *
 * La causa era strutturale, non un caso sfortunato: il modello descriveva **solo il
 * compratore**. Il venditore non decideva, non ricomprava, non aveva una cassa — quindi nulla
 * si accorgeva del buco e nulla lo riempiva. Questi test bloccano le regole che lo rendono
 * impossibile per costruzione.
 *
 * Il mondo di prova è **volutamente diverso** da quello di `dsAiWorld.test.ts`: lì tutti i club
 * hanno la stessa identica composizione di ruoli, quindi hanno tutti lo stesso bisogno e
 * muoversi sullo stesso reparto è la risposta *giusta*. Qui le rose sono di forma diversa, così
 * le regole hanno davvero qualcosa da discriminare.
 */

const IMPIANTI: Role[][] = [
  // Molti attaccanti, difesa al minimo: ha da vendere davanti, gli serve dietro.
  ["POR", "POR", "POR", "DC", "DC", "DC", "TD", "TS", "TD", "MED", "CC", "CC", "ED", "ES", "TRQ", "ATT", "ATT", "ATT", "ATT", "ATT", "DC", "CC", "ATT", "MED"],
  // Difesa profondissima, attacco corto: lo specchio del primo.
  ["POR", "POR", "DC", "DC", "DC", "DC", "DC", "TD", "TD", "TS", "TS", "MED", "MED", "CC", "CC", "CC", "ED", "ES", "TRQ", "ATT", "ATT", "ATT", "DC", "CC"],
  // Centrocampo affollato.
  ["POR", "POR", "DC", "DC", "TD", "TS", "MED", "MED", "CC", "CC", "CC", "CC", "ED", "ED", "ES", "ES", "TRQ", "TRQ", "ATT", "ATT", "ATT", "CC", "MED", "DC"],
];

function mondoVario(): { clubs: WorldClub[]; players: WorldPlayer[] } {
  const clubs: WorldClub[] = Array.from({ length: 14 }, (_, i) => ({
    id: `v${i}`,
    name: `Varia ${i}`,
    leagueId: "serie-a",
    prestigeTier: 1 + (i % 5),
  }));

  const players: WorldPlayer[] = [];
  for (const [ci, club] of clubs.entries()) {
    const impianto = IMPIANTI[ci % IMPIANTI.length]!;
    for (const [p, role] of impianto.entries()) {
      // Nessuno vicino al ritiro: qui il soggetto è il mercato, non il ciclo di vita.
      const eta = 21 + ((p * 3 + ci) % 11);
      players.push({
        id: `v${ci}-p${p}`,
        name: `Vario ${ci}-${p}`,
        nation: "Italia",
        role,
        secondaryRoles: [],
        department: ROLE_DEPARTMENT[role],
        birthDate: `${2025 - eta}-03-15`,
        // La forza dipende dal club: senza dislivello non ci sarebbe alcun mercato da osservare.
        overall: 62 + ci * 2 + (p % 11),
        clubId: club.id,
      });
    }
  }
  return { clubs, players };
}

function mercatoVario(seed = "vario", season = 2) {
  const { clubs, players } = mondoVario();
  const evoluto = evolveWorld({
    clubs,
    players,
    ownClubId: "v0",
    ownedByUser: new Set(),
    seed,
    season,
    transfers: [],
  });
  const transfers = planWorldTransfers({
    clubs,
    byClub: evoluto.byClub,
    ownClubId: "v0",
    seed,
    season,
  });
  return { clubs, evoluto, transfers };
}

/** Le rose di ogni club **dopo** aver applicato le operazioni della finestra. */
function rosePostMercato(
  byClub: Map<string, WorldPlayer[]>,
  transfers: readonly WorldTransfer[],
): Map<string, WorldPlayer[]> {
  const dopo = new Map<string, WorldPlayer[]>();
  for (const [clubId, rosa] of byClub) dopo.set(clubId, [...rosa]);
  for (const t of transfers) {
    const partenza = dopo.get(t.fromClubId);
    const arrivo = dopo.get(t.toClubId);
    const player = partenza?.find((p) => p.id === t.playerId);
    if (!partenza || !arrivo || !player) continue;
    dopo.set(
      t.fromClubId,
      partenza.filter((p) => p.id !== t.playerId),
    );
    arrivo.push(player);
  }
  return dopo;
}

const REPARTI: Department[] = ["POR", "DIF", "CC", "ATT"];
const TITOLARI: Record<Department, number> = { POR: 1, DIF: 4, CC: 4, ATT: 2 };

function qualitaTitolari(rosa: WorldPlayer[], dep: Department): number {
  const migliori = rosa
    .filter((p) => p.department === dep)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, TITOLARI[dep]);
  return migliori.length > 0 ? migliori.reduce((s, p) => s + p.overall, 0) / migliori.length : 0;
}

describe("realismo del mercato IA", () => {
  it("con rose di forma diversa il mercato tocca reparti diversi", () => {
    const { evoluto, transfers } = mercatoVario();
    expect(transfers.length).toBeGreaterThan(0);
    const reparti = new Set(transfers.map((t) => t.department));
    expect(reparti.size).toBeGreaterThan(1);
    // Coerenza fra il reparto dichiarato nella notizia e quello vero del giocatore.
    for (const t of transfers) {
      expect(t.department).toBe(evoluto.byId.get(t.playerId)?.department);
    }
  });

  /**
   * **La regola numero uno**: dopo la finestra nessuno è sceso sotto titolari+panchina in un
   * reparto per aver venduto. Una rosa incompleta non scende in campo, e nessun dirigente si
   * mette in quella condizione per incassare.
   */
  it("nessun club finisce sotto il fabbisogno di un reparto per aver venduto", () => {
    const { evoluto, transfers } = mercatoVario();
    const dopo = rosePostMercato(evoluto.byClub, transfers);

    for (const [clubId, rosaDopo] of dopo) {
      const rosaPrima = evoluto.byClub.get(clubId) ?? [];
      for (const dep of REPARTI) {
        const prima = rosaPrima.filter((p) => p.department === dep).length;
        const adesso = rosaDopo.filter((p) => p.department === dep).length;
        if (prima >= FABBISOGNO_PER_REPARTO[dep]) {
          expect(adesso).toBeGreaterThanOrEqual(FABBISOGNO_PER_REPARTO[dep]);
        } else {
          // Chi partiva già scoperto non può peggiorare.
          expect(adesso).toBeGreaterThanOrEqual(prima);
        }
      }
    }
  });

  /**
   * ⚠️ **Le catene di sostituzione sono state rimosse** (decisione dell'utente, 2026-08-14).
   *
   * Il modello precedente imponeva che chi cede un titolare lo rimpiazzasse nella stessa
   * finestra, e questo test lo verificava. Ma la regola produceva proprio il difetto che l'utente
   * ha segnalato: *"a catena ci sarà la squadra che ha venduto Caio che necessiterà di acquistare
   * Sempronio"* — ogni movimento ne imponeva un altro **dello stesso ruolo**, cioè l'opposto di
   * come si comporta un club vero, che interviene dove serve a lui.
   *
   * L'invariante che conta resta, e si regge su un'altra gamba: si vende solo da un reparto che
   * **dopo l'uscita è ancora sopra il fabbisogno**. È il test qui sotto a garantirla, non più la
   * catena.
   */
  it("un club che vende non è costretto a ricomprare nello stesso reparto", () => {
    /**
     * La proprietà nuova, ed è quella che l'utente ha chiesto: *"non per forza una squadra che
     * vende un ATT comprerà un ATT se non ne ha di bisogno"*. Si misura sull'insieme delle
     * operazioni: se esistesse ancora la catena, **ogni** club venditore comprerebbe nello stesso
     * reparto in cui ha ceduto.
     */
    const { transfers } = mercatoVario();
    const venditori = new Set(transfers.map((t) => t.fromClubId));
    expect(venditori.size).toBeGreaterThan(0);

    const haRicompratoNelloStessoReparto = (clubId: string) => {
      const usciti = transfers.filter((t) => t.fromClubId === clubId);
      const entrati = transfers.filter((t) => t.toClubId === clubId);
      return usciti.some((u) => entrati.some((e) => e.department === u.department));
    };

    const vincolati = [...venditori].filter(haRicompratoNelloStessoReparto).length;
    expect(vincolati).toBeLessThan(venditori.size);
  });

  it("la qualità dei titolari di un reparto non crolla per una cessione", () => {
    const { evoluto, transfers } = mercatoVario();
    const dopo = rosePostMercato(evoluto.byClub, transfers);

    for (const [clubId, rosaDopo] of dopo) {
      const rosaPrima = evoluto.byClub.get(clubId) ?? [];
      for (const dep of REPARTI) {
        // Tre punti di tolleranza: è il tetto dichiarato dello scarto col rimpiazzo.
        expect(qualitaTitolari(rosaDopo, dep)).toBeGreaterThanOrEqual(
          qualitaTitolari(rosaPrima, dep) - 3.01,
        );
      }
    }
  });

  it("nessun giocatore si muove due volte nella stessa finestra", () => {
    const { transfers } = mercatoVario();
    const ids = transfers.map((t) => t.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("i giocatori si muovono verso l'alto, rimpiazzi compresi", () => {
    const { evoluto, transfers } = mercatoVario();
    const forza = (id: string) => {
      const rosa = evoluto.byClub.get(id) ?? [];
      const undici = [...rosa].sort((a, b) => b.overall - a.overall).slice(0, 11);
      return undici.length > 0 ? undici.reduce((s, p) => s + p.overall, 0) / undici.length : 70;
    };
    for (const t of transfers) {
      expect(forza(t.toClubId)).toBeGreaterThan(forza(t.fromClubId));
    }
  });

  it("la cassa è un limite vero: nessuno compra all'infinito", () => {
    const { clubs, transfers } = mercatoVario();
    const spesa = new Map<string, number>();
    for (const t of transfers) spesa.set(t.toClubId, (spesa.get(t.toClubId) ?? 0) + t.fee);

    for (const [clubId, totale] of spesa) {
      const club = clubs.find((c) => c.id === clubId)!;
      // Dotazione iniziale (prestigio + livello) più al più un reinvestimento di quanto incassato.
      const incassato = transfers
        .filter((t) => t.fromClubId === clubId)
        .reduce((s, t) => s + t.fee, 0);
      expect(totale).toBeLessThanOrEqual(6_000_000 * club.prestigeTier + 200_000_000 + incassato);
    }
  });

  it("il club dell'utente resta fuori: il mondo non gestisce la sua rosa", () => {
    const { transfers } = mercatoVario();
    expect(transfers.every((t) => t.fromClubId !== "v0" && t.toClubId !== "v0")).toBe(true);
  });

  it("è riproducibile: stesso seme, stesso mercato", () => {
    expect(mercatoVario("ripetibile").transfers).toEqual(mercatoVario("ripetibile").transfers);
  });

  it("ogni operazione porta tipo e reparto, per il notiziario", () => {
    const { transfers } = mercatoVario();
    for (const t of transfers) {
      expect(["colpo", "sostituzione", "esubero"]).toContain(t.kind);
      expect(REPARTI).toContain(t.department!);
      expect(t.fee).toBeGreaterThan(0);
      expect(t.fromClubId).not.toBe(t.toClubId);
    }
  });
});

/**
 * **La scala a cui il difetto si era manifestato.** L'utente non ha visto una singola operazione
 * strana: ha visto una squadra ridotta male dopo una stagione di mercato. Una finestra sola non
 * basta a dimostrare che il modello regge — gli errori di questo tipo si accumulano.
 */
describe("il mondo dopo cinque stagioni di mercato", () => {
  function carriera(stagioni: number) {
    const { clubs, players } = mondoVario();
    let storico: WorldTransfer[] = [];
    let ultimo = evolveWorld({
      clubs,
      players,
      ownClubId: "v0",
      ownedByUser: new Set(),
      seed: "lungo",
      season: 1,
      transfers: storico,
    });

    for (let season = 2; season <= stagioni; season++) {
      ultimo = evolveWorld({
        clubs,
        players,
        ownClubId: "v0",
        ownedByUser: new Set(),
        seed: "lungo",
        season,
        transfers: storico,
      });
      const nuovi = planWorldTransfers({
        clubs,
        byClub: ultimo.byClub,
        ownClubId: "v0",
        seed: "lungo",
        season,
      });
      storico = [...storico, ...nuovi];
    }

    // Il mondo come si presenta dopo l'ultima finestra.
    const finale = evolveWorld({
      clubs,
      players,
      ownClubId: "v0",
      ownedByUser: new Set(),
      seed: "lungo",
      season: stagioni,
      transfers: storico,
    });
    return { clubs, storico, finale };
  }

  it("nessuna rosa resta senza un reparto, e nessuna si svuota", () => {
    const { clubs, finale } = carriera(6);
    for (const club of clubs) {
      if (club.id === "v0") continue;
      const rosa = finale.byClub.get(club.id) ?? [];
      expect(rosa.length).toBeGreaterThanOrEqual(16);
      for (const dep of REPARTI) {
        // Il ciclo di vita (ritiri e regen) può muovere i conteggi, ma nessun reparto
        // può restare **vuoto**: è il sintomo che l'utente ha visto.
        expect(rosa.filter((p) => p.department === dep).length).toBeGreaterThan(0);
      }
    }
  });

  it("la gerarchia regge: chi era forte non finisce in fondo per colpa del mercato", () => {
    const { clubs, finale } = carriera(6);
    const forza = (id: string) => {
      const rosa = finale.byClub.get(id) ?? [];
      const undici = [...rosa].sort((a, b) => b.overall - a.overall).slice(0, 11);
      return undici.length > 0 ? undici.reduce((s, p) => s + p.overall, 0) / undici.length : 0;
    };
    const forti = clubs.filter((c) => c.id !== "v0").slice(-4).map((c) => forza(c.id));
    const deboli = clubs.filter((c) => c.id !== "v0").slice(0, 4).map((c) => forza(c.id));
    const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    expect(media(forti)).toBeGreaterThan(media(deboli));
  });

  it("il mercato resta vivo per tutte le stagioni, non si spegne dopo la prima", () => {
    const { storico } = carriera(6);
    const perStagione = new Map<number, number>();
    for (const t of storico) perStagione.set(t.season, (perStagione.get(t.season) ?? 0) + 1);
    for (let s = 2; s <= 6; s++) {
      expect(perStagione.get(s) ?? 0).toBeGreaterThan(0);
    }
  });
});
