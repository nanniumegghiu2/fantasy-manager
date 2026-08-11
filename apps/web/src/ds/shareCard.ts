/**
 * La **card del trionfo**: l'immagine che si condivide con gli amici.
 *
 * ## Perché disegnata a mano su canvas e non convertita dal DOM
 *
 * La strada ovvia sarebbe stata `html2canvas` sulla schermata di trionfo. Scartata: è una
 * dipendenza pesante su un bundle che deve restare piccolo (CLAUDE.md sez. 1), e rende in modo
 * notoriamente incerto proprio gradienti, ombre e font — cioè tutto ciò che rende bella questa
 * card. L'altra strada, un SVG serializzato e ridisegnato su canvas, avrebbe richiesto di
 * **incorporare Manrope in base64** dentro l'SVG, perché un `<img>` SVG non vede i font della
 * pagina: decine di KB e un punto di rottura silenzioso.
 *
 * Disegnando direttamente sul canvas il font non è un problema — il canvas usa i font già
 * caricati nel documento — **a patto di aspettare `document.fonts.ready` prima di disegnare**.
 * Se lo si dimentica la prima card esce con un ripiego di sistema e le successive no, che è
 * esattamente il genere di difetto che sfugge a una verifica veloce.
 *
 * ## Niente rete
 *
 * L'immagine nasce e resta sul dispositivo: nessuna chiamata, nessun servizio esterno, nessun
 * dato che parte da solo. Se ne va solo quando è l'utente a condividerla.
 */

/** I due formati: uno per il feed, uno per le storie a tutto schermo. */
export type ShareFormat = "post" | "storia";

const DIMENSIONI: Record<ShareFormat, { w: number; h: number }> = {
  post: { w: 1080, h: 1350 },
  storia: { w: 1080, h: 1920 },
};

export interface ShareCardData {
  clubName: string;
  season: number;
  /** "Serie A", "Serie B"… */
  leagueName: string;
  trophies: { league: boolean; continental: boolean; national: boolean };
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  position: number;
  /** Capocannoniere della rosa: nome e gol. */
  topScorer?: { name: string; goals: number };
}

/** Quanti trofei: decide il titolo, l'intensità e quanto oro c'è nella card. */
export function trophyCount(t: ShareCardData["trophies"]): number {
  return Number(t.league) + Number(t.continental) + Number(t.national);
}

/** Il titolo grande della card, per numero di trofei. */
export function triumphTitle(data: ShareCardData): string {
  const n = trophyCount(data.trophies);
  if (n >= 3) return "TRIPLETE";
  if (n === 2) return "DOPPIETTA";
  if (data.trophies.league) return "CAMPIONI";
  if (data.trophies.continental) return "CORONA CONTINENTALE";
  if (data.trophies.national) return "COPPA TRICOLORE";
  return "LA NOSTRA STAGIONE";
}

/** I nomi dei trofei vinti, per la riga sotto il titolo. */
export function trophyLabels(t: ShareCardData["trophies"]): string[] {
  const out: string[] = [];
  if (t.league) out.push("Campionato");
  if (t.continental) out.push("Corona Continentale");
  if (t.national) out.push("Coppa Tricolore");
  return out;
}

const ORO = "#f5c518";
const ORO_SCURO = "#b8901a";
const VERDE = "#455d59";
const RAME = "#805e56";

/** Disegna una coppa stilizzata — grafica originale, nessun asset di terzi (sez. 2). */
function coppa(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colore: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colore;

  // Vasca
  ctx.beginPath();
  ctx.moveTo(-0.32 * s, -0.5 * s);
  ctx.lineTo(0.32 * s, -0.5 * s);
  ctx.quadraticCurveTo(0.3 * s, 0.12 * s, 0, 0.2 * s);
  ctx.quadraticCurveTo(-0.3 * s, 0.12 * s, -0.32 * s, -0.5 * s);
  ctx.closePath();
  ctx.fill();

  // Manici
  ctx.lineWidth = 0.06 * s;
  ctx.strokeStyle = colore;
  for (const verso of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(verso * 0.32 * s, -0.44 * s);
    ctx.quadraticCurveTo(verso * 0.56 * s, -0.32 * s, verso * 0.34 * s, -0.12 * s);
    ctx.stroke();
  }

  // Stelo e base
  ctx.fillRect(-0.05 * s, 0.2 * s, 0.1 * s, 0.2 * s);
  ctx.fillRect(-0.22 * s, 0.4 * s, 0.44 * s, 0.09 * s);
  ctx.restore();
}

/** Testo centrato, con troncamento se non ci sta: meglio corto che fuori dai bordi. */
function centrato(ctx: CanvasRenderingContext2D, testo: string, y: number, maxW: number) {
  let t = testo;
  while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -1);
  if (t !== testo) t = `${t.trimEnd()}…`;
  ctx.fillText(t, ctx.canvas.width / 2, y);
}

/**
 * Disegna la card e la restituisce come PNG.
 *
 * Rifiuta di produrre un'immagine se il canvas non è disponibile (ambienti senza DOM): meglio
 * un errore chiaro di un file vuoto che l'utente scoprirebbe solo dopo averlo condiviso.
 */
export async function renderShareCard(
  data: ShareCardData,
  format: ShareFormat = "post",
): Promise<Blob> {
  const { w, h } = DIMENSIONI[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile su questo dispositivo");

  // Senza questa attesa il testo esce col font di sistema invece che con Manrope, e succede
  // solo alla prima generazione: il difetto più facile da non vedere di tutta la funzione.
  if (document.fonts?.ready) await document.fonts.ready;

  const n = trophyCount(data.trophies);

  // Fondo: verde campo scuro, con un alone caldo che cresce coi trofei.
  const fondo = ctx.createLinearGradient(0, 0, 0, h);
  fondo.addColorStop(0, "#0e1614");
  fondo.addColorStop(0.55, n >= 3 ? "#20200f" : "#132320");
  fondo.addColorStop(1, "#0e1614");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, w, h);

  const alone = ctx.createRadialGradient(w / 2, h * 0.34, 0, w / 2, h * 0.34, w * 0.75);
  alone.addColorStop(0, n >= 3 ? "rgba(245,197,24,0.30)" : n === 2 ? "rgba(245,197,24,0.18)" : "rgba(69,93,89,0.35)");
  alone.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = alone;
  ctx.fillRect(0, 0, w, h);

  // Linee di campo in filigrana: grafica originale, come il `PitchBackdrop` della home.
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h / 2);
  ctx.lineTo(w * 0.92, h / 2);
  ctx.stroke();

  ctx.textAlign = "center";
  const top = format === "storia" ? h * 0.13 : h * 0.08;

  // Stagione e campionato.
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 34px Manrope, system-ui, sans-serif";
  centrato(ctx, `${data.leagueName.toUpperCase()} · STAGIONE ${data.season}`, top + 40, w * 0.8);

  // Il club.
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 84px Manrope, system-ui, sans-serif";
  centrato(ctx, data.clubName, top + 150, w * 0.86);

  // I trofei.
  const yCoppe = top + 320;
  const colore = n >= 3 ? ORO : n === 2 ? ORO : RAME;
  const dimensione = n >= 3 ? 210 : n === 2 ? 230 : 260;
  const passo = dimensione * 0.78;
  const partenza = w / 2 - ((Math.max(n, 1) - 1) * passo) / 2;
  for (let i = 0; i < Math.max(n, 1); i++) {
    coppa(ctx, partenza + i * passo, yCoppe, dimensione, n === 0 ? "rgba(255,255,255,0.18)" : colore);
  }

  // Il titolo.
  ctx.fillStyle = n >= 3 ? ORO : "#ffffff";
  ctx.font = `900 ${n >= 3 ? 118 : 92}px Manrope, system-ui, sans-serif`;
  const yTitolo = yCoppe + (n >= 3 ? 220 : 210);
  centrato(ctx, triumphTitle(data), yTitolo, w * 0.9);

  // I trofei per esteso.
  const etichette = trophyLabels(data.trophies);
  if (etichette.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "600 36px Manrope, system-ui, sans-serif";
    centrato(ctx, etichette.join("  ·  "), yTitolo + 62, w * 0.9);
  }

  /**
   * I numeri: è la parte che rende il trionfo raccontabile a un amico che al gioco non ha mai
   * giocato. Senza, la card direbbe solo "ho vinto" — con, dice *come*.
   */
  const yNumeri = yTitolo + (format === "storia" ? 260 : 190);
  const celle: { valore: string; etichetta: string }[] = [
    { valore: `${data.position}º`, etichetta: "in campionato" },
    { valore: String(data.points), etichetta: "punti" },
    {
      valore: `${data.goalsFor >= data.goalsAgainst ? "+" : ""}${data.goalsFor - data.goalsAgainst}`,
      etichetta: "differenza reti",
    },
  ];
  const larghezza = w * 0.84;
  const cella = larghezza / celle.length;
  celle.forEach((c, i) => {
    const x = w / 2 - larghezza / 2 + cella * (i + 0.5);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 68px Manrope, system-ui, sans-serif";
    ctx.fillText(c.valore, x, yNumeri);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 28px Manrope, system-ui, sans-serif";
    ctx.fillText(c.etichetta, x, yNumeri + 44);
  });

  if (data.topScorer) {
    ctx.fillStyle = ORO_SCURO;
    ctx.font = "700 34px Manrope, system-ui, sans-serif";
    centrato(
      ctx,
      `${data.topScorer.name} · ${data.topScorer.goals} gol`,
      yNumeri + 118,
      w * 0.86,
    );
  }

  /**
   * Wordmark e disclaimer.
   *
   * Il disclaimer **non è pedanteria**: l'immagine porta il nome di un club reale *fuori*
   * dall'app, dove sparisce il contesto che la qualifica come gioco indipendente. In app quel
   * contesto c'è, in un post no (CLAUDE.md sez. 2). Il wordmark, per inciso, è anche l'unica
   * promozione che questa funzione si porta dietro.
   */
  const yPiede = h - (format === "storia" ? 210 : 130);
  ctx.fillStyle = VERDE;
  ctx.fillRect(w / 2 - 130, yPiede - 46, 260, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px Manrope, system-ui, sans-serif";
  ctx.fillText("FANTASY MANAGER", w / 2, yPiede + 4);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "500 21px Manrope, system-ui, sans-serif";
  ctx.fillText(
    "Gioco indipendente non affiliato a leghe, club o calciatori citati.",
    w / 2,
    yPiede + 44,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Non sono riuscito a creare l'immagine"))),
      "image/png",
    );
  });
}

/** Il testo che accompagna l'immagine quando si condivide. */
export function shareText(data: ShareCardData): string {
  const etichette = trophyLabels(data.trophies);
  const parte = etichette.length > 0 ? `Abbiamo vinto: ${etichette.join(", ")}.` : "Che stagione.";
  return `${data.clubName} — stagione ${data.season}. ${parte} #FantasyManager`;
}

/** Esito di un tentativo di condivisione, per dire all'utente cosa è successo davvero. */
export type ShareOutcome = "condiviso" | "scaricato" | "annullato" | "errore";

/**
 * Condivide la card.
 *
 * **Percorso principale: il foglio di condivisione nativo** (`navigator.share` con il file
 * allegato), perché l'app è mobile-first ed è così che l'immagine arriva su WhatsApp o
 * Instagram in due tocchi. Dove non è supportato — desktop, browser vecchi — si ripiega sul
 * download del PNG più il testo negli appunti, che è il massimo che il browser conceda.
 */
export async function shareTriumph(
  data: ShareCardData,
  format: ShareFormat = "post",
): Promise<ShareOutcome> {
  let blob: Blob;
  try {
    blob = await renderShareCard(data, format);
  } catch {
    return "errore";
  }

  const file = new File([blob], `fantasy-manager-${data.clubName}-${data.season}.png`, {
    type: "image/png",
  });
  const testo = shareText(data);

  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: testo, title: "Fantasy Manager" });
      return "condiviso";
    } catch (error) {
      // L'utente che chiude il foglio di condivisione non ha sbagliato nulla: non è un errore,
      // e dirglielo lo confonderebbe.
      if (error instanceof DOMException && error.name === "AbortError") return "annullato";
      // Qualunque altro problema: si ripiega sul download invece di lasciarlo a mani vuote.
    }
  }

  try {
    scaricaBlob(blob, file.name);
    await navigator.clipboard?.writeText?.(testo).catch(() => undefined);
    return "scaricato";
  } catch {
    return "errore";
  }
}

/** Salva la card senza passare dal foglio di condivisione. */
export async function downloadTriumph(
  data: ShareCardData,
  format: ShareFormat = "post",
): Promise<ShareOutcome> {
  try {
    const blob = await renderShareCard(data, format);
    scaricaBlob(blob, `fantasy-manager-${data.clubName}-${data.season}.png`);
    return "scaricato";
  } catch {
    return "errore";
  }
}

function scaricaBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  // Rilasciare subito romperebbe il download su alcuni browser: si lascia un attimo di respiro.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
