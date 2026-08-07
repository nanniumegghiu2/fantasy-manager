/**
 * Bandierina di nazionalità e sigla del campionato, per leggere a colpo d'occhio da dove
 * viene un giocatore — serve sia sulla lavagna tattica sia nelle liste del draft, perché è
 * l'informazione che decide le linee di intesa (sez. 3.4: nazione e campionato sono due dei
 * tre tratti condivisi).
 *
 * Vincoli rispettati (CLAUDE.md sez. 2 e 8):
 *  - **niente asset ufficiali**: le bandiere sono ridisegnate da noi come poche fasce di
 *    colore, non file scaricati; a 14px una bandiera vera sarebbe comunque illeggibile;
 *  - **niente loghi di lega**: del campionato si mostra solo una **sigla testuale**, mai un
 *    wordmark;
 *  - **niente emoji**: escluse le bandierine emoji, che sarebbero state la scorciatoia ovvia.
 */

type Pattern = "v" | "h";

interface FlagSpec {
  /** Codice a 3 lettere mostrato accanto alla bandierina. */
  code: string;
  pattern: Pattern;
  colors: string[];
}

/**
 * Le nazioni presenti nel pool, in italiano come nel database. Coperte le più frequenti
 * (oltre il 98% dei giocatori); per le altre `nationFlag` ricava comunque una sigla dal nome
 * e usa una bandierina neutra, così non resta mai un buco.
 */
const FLAGS: Record<string, FlagSpec> = {
  Spagna: { code: "ESP", pattern: "h", colors: ["#c60b1e", "#ffc400", "#c60b1e"] },
  Francia: { code: "FRA", pattern: "v", colors: ["#002395", "#ffffff", "#ed2939"] },
  Germania: { code: "GER", pattern: "h", colors: ["#000000", "#dd0000", "#ffce00"] },
  Inghilterra: { code: "ENG", pattern: "v", colors: ["#ffffff", "#ce1124", "#ffffff"] },
  Italia: { code: "ITA", pattern: "v", colors: ["#009246", "#ffffff", "#ce2b37"] },
  Brasile: { code: "BRA", pattern: "h", colors: ["#009c3b", "#ffdf00", "#002776"] },
  "Paesi Bassi": { code: "NED", pattern: "h", colors: ["#ae1c28", "#ffffff", "#21468b"] },
  Argentina: { code: "ARG", pattern: "h", colors: ["#75aadb", "#ffffff", "#75aadb"] },
  Belgio: { code: "BEL", pattern: "v", colors: ["#000000", "#fdda24", "#ef3340"] },
  Portogallo: { code: "POR", pattern: "v", colors: ["#046a38", "#046a38", "#da291c"] },
  Danimarca: { code: "DEN", pattern: "v", colors: ["#c8102e", "#ffffff", "#c8102e"] },
  Senegal: { code: "SEN", pattern: "v", colors: ["#00853f", "#fdef42", "#e31b23"] },
  Marocco: { code: "MAR", pattern: "h", colors: ["#c1272d", "#006233", "#c1272d"] },
  Svizzera: { code: "SUI", pattern: "v", colors: ["#d52b1e", "#ffffff", "#d52b1e"] },
  "Costa d'Avorio": { code: "CIV", pattern: "v", colors: ["#f77f00", "#ffffff", "#009e60"] },
  Svezia: { code: "SWE", pattern: "v", colors: ["#006aa7", "#fecc00", "#006aa7"] },
  Austria: { code: "AUT", pattern: "h", colors: ["#ed2939", "#ffffff", "#ed2939"] },
  Croazia: { code: "CRO", pattern: "h", colors: ["#ff0000", "#ffffff", "#171796"] },
  Nigeria: { code: "NGA", pattern: "v", colors: ["#008751", "#ffffff", "#008751"] },
  Norvegia: { code: "NOR", pattern: "v", colors: ["#ba0c2f", "#ffffff", "#00205b"] },
  "Stati Uniti": { code: "USA", pattern: "h", colors: ["#b31942", "#ffffff", "#0a3161"] },
  Ghana: { code: "GHA", pattern: "h", colors: ["#ce1126", "#fcd116", "#006b3f"] },
  Serbia: { code: "SRB", pattern: "h", colors: ["#c6363c", "#0c4076", "#ffffff"] },
  Camerun: { code: "CMR", pattern: "v", colors: ["#007a5e", "#ce1126", "#fcd116"] },
  Polonia: { code: "POL", pattern: "h", colors: ["#ffffff", "#ffffff", "#dc143c"] },
  Scozia: { code: "SCO", pattern: "h", colors: ["#0065bf", "#ffffff", "#0065bf"] },
  Giappone: { code: "JPN", pattern: "h", colors: ["#ffffff", "#bc002d", "#ffffff"] },
  Turchia: { code: "TUR", pattern: "h", colors: ["#e30a17", "#e30a17", "#e30a17"] },
  Algeria: { code: "ALG", pattern: "v", colors: ["#006233", "#ffffff", "#006233"] },
  ALG: { code: "ALG", pattern: "v", colors: ["#006233", "#ffffff", "#006233"] },
  Uruguay: { code: "URU", pattern: "h", colors: ["#ffffff", "#0038a8", "#ffffff"] },
  Mali: { code: "MLI", pattern: "v", colors: ["#14b53a", "#fcd116", "#ce1126"] },
  Colombia: { code: "COL", pattern: "h", colors: ["#fcd116", "#003893", "#ce1126"] },
  "Rep. Democratica del Congo": { code: "COD", pattern: "h", colors: ["#007fff", "#f7d618", "#ce1021"] },
  Grecia: { code: "GRE", pattern: "h", colors: ["#0d5eaf", "#ffffff", "#0d5eaf"] },
  Galles: { code: "WAL", pattern: "h", colors: ["#ffffff", "#c8102e", "#00b140"] },
  "Rep. Ceca": { code: "CZE", pattern: "h", colors: ["#ffffff", "#d7141a", "#11457e"] },
  "Repubblica Ceca": { code: "CZE", pattern: "h", colors: ["#ffffff", "#d7141a", "#11457e"] },
  Ucraina: { code: "UKR", pattern: "h", colors: ["#0057b7", "#0057b7", "#ffd700"] },
  Irlanda: { code: "IRL", pattern: "v", colors: ["#169b62", "#ffffff", "#ff883e"] },
  Kosovo: { code: "KOS", pattern: "h", colors: ["#244aa5", "#244aa5", "#d0a650"] },
  Ungheria: { code: "HUN", pattern: "h", colors: ["#ce2939", "#ffffff", "#477050"] },
  Slovacchia: { code: "SVK", pattern: "h", colors: ["#ffffff", "#0b4ea2", "#ee1c25"] },
  "Bosnia ed Erzegovina": { code: "BIH", pattern: "v", colors: ["#002395", "#fecb00", "#002395"] },
  Albania: { code: "ALB", pattern: "h", colors: ["#e41e20", "#000000", "#e41e20"] },
  Islanda: { code: "ISL", pattern: "v", colors: ["#02529c", "#ffffff", "#dc1e35"] },
  "Corea del Sud": { code: "KOR", pattern: "h", colors: ["#ffffff", "#cd2e3a", "#0047a0"] },
  Georgia: { code: "GEO", pattern: "v", colors: ["#ffffff", "#ff0000", "#ffffff"] },
  Canada: { code: "CAN", pattern: "v", colors: ["#d80621", "#ffffff", "#d80621"] },
  Romania: { code: "ROU", pattern: "v", colors: ["#002b7f", "#fcd116", "#ce1126"] },
  Cile: { code: "CHI", pattern: "h", colors: ["#0039a6", "#ffffff", "#d52b1e"] },
  "Burkina Faso": { code: "BFA", pattern: "h", colors: ["#ef2b2d", "#ef2b2d", "#009e49"] },
  Paraguay: { code: "PAR", pattern: "h", colors: ["#d52b1e", "#ffffff", "#0038a8"] },
  Ecuador: { code: "ECU", pattern: "h", colors: ["#ffdd00", "#0072ce", "#ef3340"] },
  Tunisia: { code: "TUN", pattern: "h", colors: ["#e70013", "#ffffff", "#e70013"] },
  Guinea: { code: "GUI", pattern: "v", colors: ["#ce1126", "#fcd116", "#009460"] },
  Australia: { code: "AUS", pattern: "h", colors: ["#00008b", "#00008b", "#e4002b"] },
  Slovenia: { code: "SVN", pattern: "h", colors: ["#ffffff", "#0000ff", "#ff0000"] },
  Messico: { code: "MEX", pattern: "v", colors: ["#006847", "#ffffff", "#ce1126"] },
  "Irlanda del Nord": { code: "NIR", pattern: "h", colors: ["#ffffff", "#c8102e", "#ffffff"] },
  Montenegro: { code: "MNE", pattern: "h", colors: ["#c40308", "#d4af3a", "#c40308"] },
  Israele: { code: "ISR", pattern: "h", colors: ["#ffffff", "#0038b8", "#ffffff"] },
  Angola: { code: "ANG", pattern: "h", colors: ["#ce1126", "#ce1126", "#000000"] },
  Gambia: { code: "GAM", pattern: "h", colors: ["#ce1126", "#0c1c8c", "#3a7728"] },
  Egitto: { code: "EGY", pattern: "h", colors: ["#ce1126", "#ffffff", "#000000"] },
  Gabon: { code: "GAB", pattern: "h", colors: ["#009e60", "#fcd116", "#3a75c4"] },
  Venezuela: { code: "VEN", pattern: "h", colors: ["#fcd116", "#00247d", "#cf142b"] },
  Togo: { code: "TOG", pattern: "h", colors: ["#006a4e", "#ffce00", "#006a4e"] },
  Finlandia: { code: "FIN", pattern: "v", colors: ["#ffffff", "#003580", "#ffffff"] },
  Russia: { code: "RUS", pattern: "h", colors: ["#ffffff", "#0039a6", "#d52b1e"] },
  Comore: { code: "COM", pattern: "h", colors: ["#ffc61e", "#ffffff", "#3d8e33"] },
  "Guinea-Bissau": { code: "GNB", pattern: "h", colors: ["#fcd116", "#009e49", "#ce1126"] },
  Luxembourg: { code: "LUX", pattern: "h", colors: ["#ed2939", "#ffffff", "#00a1de"] },
  Indonesia: { code: "IDN", pattern: "h", colors: ["#ce1126", "#ce1126", "#ffffff"] },
  Armenia: { code: "ARM", pattern: "h", colors: ["#d90012", "#0033a0", "#f2a800"] },
  "Guinea Equatoriale": { code: "GEQ", pattern: "h", colors: ["#3e9a00", "#ffffff", "#e32118"] },
  Estonia: { code: "EST", pattern: "h", colors: ["#0072ce", "#000000", "#ffffff"] },
  Suriname: { code: "SUR", pattern: "h", colors: ["#377e3f", "#c8102e", "#377e3f"] },
  Zambia: { code: "ZAM", pattern: "v", colors: ["#198a00", "#ef7d00", "#198a00"] },
  Benin: { code: "BEN", pattern: "h", colors: ["#fcd116", "#fcd116", "#e8112d"] },
  Zimbabwe: { code: "ZIM", pattern: "h", colors: ["#006400", "#ffd200", "#d40000"] },
  "Macedonia del Nord": { code: "MKD", pattern: "h", colors: ["#d20000", "#ffe600", "#d20000"] },
  "Rep. Dominicana": { code: "DOM", pattern: "v", colors: ["#002d62", "#ffffff", "#ce1126"] },
  Panama: { code: "PAN", pattern: "h", colors: ["#ffffff", "#005293", "#d21034"] },
  Bulgaria: { code: "BUL", pattern: "h", colors: ["#ffffff", "#00966e", "#d62612"] },
  "Rep. Centrafricana": { code: "CTA", pattern: "h", colors: ["#003082", "#ffce00", "#289728"] },
  Haiti: { code: "HAI", pattern: "h", colors: ["#00209f", "#00209f", "#d21034"] },
  Niger: { code: "NIG", pattern: "h", colors: ["#e05206", "#ffffff", "#0db02b"] },
  Giordania: { code: "JOR", pattern: "h", colors: ["#000000", "#ffffff", "#007a3d"] },
  Giamaica: { code: "JAM", pattern: "h", colors: ["#009b3a", "#fed100", "#000000"] },
  Sudafrica: { code: "RSA", pattern: "h", colors: ["#007749", "#ffb612", "#de3831"] },
  Mozambico: { code: "MOZ", pattern: "h", colors: ["#009a00", "#000000", "#ffd100"] },
  "Cabo Verde": { code: "CPV", pattern: "h", colors: ["#003893", "#ffffff", "#003893"] },
  "Sierra Leone": { code: "SLE", pattern: "h", colors: ["#1eb53a", "#ffffff", "#0072c6"] },
  "Nuova Zelanda": { code: "NZL", pattern: "h", colors: ["#00247d", "#00247d", "#cc142b"] },
  Uzbekistan: { code: "UZB", pattern: "h", colors: ["#0099b5", "#ffffff", "#1eb53a"] },
  Malaysia: { code: "MAS", pattern: "h", colors: ["#010066", "#ffffff", "#cc0001"] },
  Lituania: { code: "LTU", pattern: "h", colors: ["#fdb913", "#006a44", "#c1272d"] },
  Burundi: { code: "BDI", pattern: "h", colors: ["#ce1126", "#ffffff", "#1eb53a"] },
  Tanzania: { code: "TAN", pattern: "h", colors: ["#1eb53a", "#000000", "#00a3dd"] },
  "Arabia Saudita": { code: "KSA", pattern: "h", colors: ["#006c35", "#006c35", "#006c35"] },
  Perù: { code: "PER", pattern: "v", colors: ["#d91023", "#ffffff", "#d91023"] },
  Libya: { code: "LBY", pattern: "h", colors: ["#e70013", "#000000", "#239e46"] },
  Honduras: { code: "HON", pattern: "h", colors: ["#0073cf", "#ffffff", "#0073cf"] },
};

const FALLBACK: FlagSpec = {
  code: "—",
  pattern: "h",
  colors: ["#8a8a8a", "#b5b5b5", "#8a8a8a"],
};

/** Sigla di ripiego per una nazione non in tabella: prime lettere significative del nome. */
function fallbackCode(nation: string): string {
  const clean = nation.replace(/[^\p{L} ]/gu, "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]! + words[1]![1]!).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}

export function nationSpec(nation: string): FlagSpec {
  const found = FLAGS[nation];
  if (found) return found;
  return { ...FALLBACK, code: fallbackCode(nation) };
}

/** Sigle dei campionati: solo testo, mai il wordmark ufficiale (sez. 2). */
const LEAGUE_CODES: Record<string, string> = {
  "Serie A": "SA",
  "Premier League": "PL",
  "La Liga": "LL",
  Bundesliga: "BL",
  "Ligue 1": "L1",
};

export function leagueCode(league: string): string {
  return LEAGUE_CODES[league] ?? league.slice(0, 2).toUpperCase();
}

/** Bandierina disegnata: 3 fasce, verticali o orizzontali. */
export function NationFlag({ nation, size = 12 }: { nation: string; size?: number }) {
  const spec = nationSpec(nation);
  const vertical = spec.pattern === "v";
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/25"
      style={{
        width: size * 1.4,
        height: size,
        flexDirection: vertical ? "row" : "column",
      }}
    >
      {spec.colors.map((color, i) => (
        <span key={i} style={{ background: color, flex: 1 }} />
      ))}
    </span>
  );
}

/**
 * Bandierina + codice nazione + sigla campionato, la riga di provenienza usata ovunque.
 * `compact` toglie il codice nazione dove lo spazio è pochissimo (gettoni sul campo).
 */
export function OriginBadge({
  nation,
  league,
  size = 12,
  compact = false,
}: {
  nation: string;
  league?: string;
  size?: number;
  compact?: boolean;
}) {
  const spec = nationSpec(nation);
  return (
    <span className="inline-flex items-center gap-1" title={league ? `${nation} · ${league}` : nation}>
      <NationFlag nation={nation} size={size} />
      {!compact && <span className="font-semibold tabular-nums">{spec.code}</span>}
      {league && (
        <span className="rounded-[3px] bg-black/20 px-1 py-px text-[9px] font-bold leading-tight">
          {leagueCode(league)}
        </span>
      )}
    </span>
  );
}
