import { useCallback, useEffect, useRef, useState } from "react";
import type { CareerState } from "@app/game-engine";
import { seasonYearLabel } from "@app/game-engine";
import { supabase } from "../lib/supabaseClient";

/**
 * Persistenza della carriera su Supabase.
 *
 * Salvataggio **con ritardo**: avanzare una settimana è un clic, e scrivere sul database a
 * ogni clic significherebbe una richiesta di rete ogni due secondi per un'ora di gioco. Si
 * accumula e si scrive dopo una pausa, più un salvataggio forzato ai momenti che contano
 * (fine stagione, uscita dalla modalità).
 *
 * Il salvataggio contiene **solo id e numeri** (vedi `CareerState`): resta sotto i 100 KB
 * anche dopo dieci stagioni, e un ricalcolo massivo degli Overall nel database non riscrive
 * in silenzio una carriera già iniziata.
 */

const AUTOSAVE_DELAY_MS = 2500;

export interface CareerSaveRow {
  id: string;
  clubId: string;
  season: number;
  week: number;
  status: string;
  updatedAt: string;
  state: CareerState;
}

interface Row {
  id: string;
  club_id: string;
  season: number;
  week: number;
  status: string;
  updated_at: string;
  state: CareerState;
}

function fromRow(row: Row): CareerSaveRow {
  return {
    id: row.id,
    clubId: row.club_id,
    season: row.season,
    week: row.week,
    status: row.status,
    updatedAt: row.updated_at,
    state: row.state,
  };
}

/** Elenca le carriere dell'utente, dalla più recente: alimenta il "continua". */
export function useCareerSaves(enabled: boolean) {
  const [saves, setSaves] = useState<CareerSaveRow[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setSaves([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("ds_careers")
      .select("id, club_id, season, week, status, updated_at, state")
      .order("updated_at", { ascending: false })
      .returns<Row[]>();
    setSaves((data ?? []).map(fromRow));
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { saves, loading, refetch };
}

/* -------------------------------------------------------------------------- */
/* Punti di ripristino                                                         */
/* -------------------------------------------------------------------------- */

export interface CareerCheckpoint {
  id: string;
  season: number;
  week: number;
  label: string;
  kind: "manuale" | "automatico";
  createdAt: string;
  state: CareerState;
}

interface CheckpointRow {
  id: string;
  season: number;
  week: number;
  label: string;
  kind: string;
  created_at: string;
  state: CareerState;
}

/** L'etichetta che si legge nell'elenco: annata e giornata, cioè dove si sta tornando. */
export function checkpointLabel(state: CareerState): string {
  const annata = seasonYearLabel(state.season);
  return state.week > 0 ? `${annata} · giornata ${state.week}` : `${annata} · pre-campionato`;
}

/**
 * **I punti di ripristino di una carriera**, dal più recente.
 *
 * Al massimo due per stagione, e il vincolo **non vive qui**: lo applica un trigger Postgres
 * (`prune_ds_career_saves`). Nel client una scheda chiusa a metà lo lascerebbe violato, e due
 * schede aperte insieme lo violerebbero comunque.
 */
export function useCareerCheckpoints(careerId: string | null) {
  const [checkpoints, setCheckpoints] = useState<CareerCheckpoint[]>([]);

  const refetch = useCallback(async () => {
    if (!careerId) {
      setCheckpoints([]);
      return;
    }
    const { data } = await supabase
      .from("ds_career_saves")
      .select("id, season, week, label, kind, created_at, state")
      .eq("career_id", careerId)
      .order("created_at", { ascending: false })
      .returns<CheckpointRow[]>();
    setCheckpoints(
      (data ?? []).map((r) => ({
        id: r.id,
        season: r.season,
        week: r.week,
        label: r.label,
        kind: r.kind === "automatico" ? "automatico" : "manuale",
        createdAt: r.created_at,
        state: r.state,
      })),
    );
  }, [careerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { checkpoints, refetch };
}

/** Crea un punto di ripristino. Il trigger tiene solo i due più recenti della stagione. */
export async function createCheckpoint(
  careerId: string,
  userId: string,
  state: CareerState,
  kind: "manuale" | "automatico" = "manuale",
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase.from("ds_career_saves").insert({
    career_id: careerId,
    user_id: userId,
    version: state.version,
    season: state.season,
    week: state.week,
    kind,
    label: checkpointLabel(state),
    state,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Salvato · ${checkpointLabel(state)}` };
}

export interface CareerPersistence {
  /** Id della riga su Supabase; `null` per una carriera non ancora salvata (ospite). */
  saveId: string | null;
  /** Registra lo stato: scrive dopo una pausa, o subito con `immediate`. */
  persist: (state: CareerState, immediate?: boolean) => void;
  saving: boolean;
  /** L'ultima scrittura è fallita: la UI lo dice, invece di far credere che sia salvato. */
  error: string | null;
}

/**
 * Tiene sincronizzata una carriera con il database.
 *
 * Senza account non salva nulla e non è un errore: la DS Mode resta giocabile da ospite per
 * una sessione, esattamente come la Classica. È l'accesso a renderla una carriera lunga.
 */
export function useCareerPersistence(
  userId: string | null,
  initialSaveId: string | null,
): CareerPersistence {
  const [saveId, setSaveId] = useState<string | null>(initialSaveId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<CareerState | null>(null);
  // L'id vive anche in un ref: due salvataggi ravvicinati partirebbero entrambi con `saveId`
  // ancora `null` e creerebbero due righe per la stessa carriera.
  const saveIdRef = useRef<string | null>(initialSaveId);

  const write = useCallback(
    async (state: CareerState) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      const payload = {
        user_id: userId,
        version: state.version,
        club_id: state.clubId,
        season: state.season,
        week: state.week,
        status: state.phase === "conclusa" ? "conclusa" : "in_corso",
        state,
      };

      const query = saveIdRef.current
        ? supabase.from("ds_careers").update(payload).eq("id", saveIdRef.current).select("id")
        : supabase.from("ds_careers").insert(payload).select("id");

      const { data, error: writeError } = await query.returns<{ id: string }[]>();
      if (writeError) setError(writeError.message);
      else if (data?.[0] && !saveIdRef.current) {
        saveIdRef.current = data[0].id;
        setSaveId(data[0].id);
      }
      setSaving(false);
    },
    [userId],
  );

  const persist = useCallback(
    (state: CareerState, immediate = false) => {
      if (!userId) return;
      pending.current = state;
      if (timer.current) clearTimeout(timer.current);
      if (immediate) {
        void write(state);
        return;
      }
      timer.current = setTimeout(() => {
        if (pending.current) void write(pending.current);
      }, AUTOSAVE_DELAY_MS);
    },
    [userId, write],
  );

  // Alla chiusura si scrive ciò che è rimasto in coda: chiudere la scheda a metà stagione non
  // deve costare le ultime giornate giocate.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) void write(pending.current);
    };
  }, [write]);

  /**
   * **La rete di sicurezza** (scelta dell'utente: il salvataggio principale lo decide lui, ma
   * il gioco scrive comunque nei tre casi in cui perdere sarebbe ingiusto).
   *
   * `pagehide` e `visibilitychange` invece di `beforeunload`: su mobile è l'unico evento che
   * arriva davvero quando la scheda va in secondo piano o viene chiusa dal sistema — e su
   * mobile è dove si gioca. `offline` copre la connessione che cade: la scrittura fallirà, ma
   * `pending` resta in coda e riparte al ritorno.
   */
  useEffect(() => {
    if (!userId) return;
    const salva = () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) void write(pending.current);
    };
    const suVisibilita = () => {
      if (document.visibilityState === "hidden") salva();
    };
    window.addEventListener("pagehide", salva);
    window.addEventListener("offline", salva);
    document.addEventListener("visibilitychange", suVisibilita);
    return () => {
      window.removeEventListener("pagehide", salva);
      window.removeEventListener("offline", salva);
      document.removeEventListener("visibilitychange", suVisibilita);
    };
  }, [userId, write]);

  return { saveId, persist, saving, error };
}

export async function deleteCareerSave(id: string): Promise<void> {
  await supabase.from("ds_careers").delete().eq("id", id);
}
