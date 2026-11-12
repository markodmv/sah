// Čitanje chess-results.com i ratings.fide.com (HTML bez vanjskih biblioteka).

const UA = "Mozilla/5.0 (sah-app)";

export async function dohvati(url: string, zaglavlja: Record<string, string> = {}): Promise<string | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en", ...zaglavlja },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return await res.text();
    } catch {
      // pokušaj ponovno
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

// Pokreće posao za svaki element, najviše `n` istovremeno.
export async function paralelno<T, R>(stavke: T[], n: number, posao: (s: T) => Promise<R>): Promise<R[]> {
  const rezultati: R[] = new Array(stavke.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, stavke.length) }, async () => {
      while (i < stavke.length) {
        const k = i++;
        rezultati[k] = await posao(stavke[k]);
      }
    })
  );
  return rezultati;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const dekodiraj = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
export const tekst = (html: string) => dekodiraj(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
export const normaliziraj = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
// Ključ imena neovisan o redoslijedu i dijakriticima ("Vašek, David" = "David Vasek")
export const kljucImena = (s: string) =>
  normaliziraj(s).replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

// ---------- chess-results ----------

export const POPIS_URL = "https://chess-results.com/fed.aspx?lan=1&fed=CRO";

export function procitajPopis(html: string) {
  const out = new Map<number, string>();
  for (const m of html.matchAll(/href="(?:https?:\/\/[^"\/]*chess-results\.com\/)?tnr(\d+)\.aspx\?lan=1">([^<]+)</g)) {
    if (!out.has(+m[1])) out.set(+m[1], tekst(m[2]));
  }
  return [...out].map(([tnr, naziv]) => ({ tnr, naziv }));
}

function polje(html: string, oznaka: string) {
  const m = html.match(new RegExp(`<td class="CR">${oznaka}[^<]*</td><td class="CR">(.*?)</td></tr>`, "i"));
  return m ? tekst(m[1]) : null;
}

function kratkiTempo(s: string | null) {
  if (!s) return null;
  const brojevi = s.match(/\d+/g) || [];
  if (brojevi.length >= 2 && s.includes("+")) return `${brojevi[0]}'+${brojevi[1]}"`;
  if (brojevi.length) return `${brojevi[0]}'`;
  return s.slice(0, 24);
}

export type Prijavljeni = { n: string; f: number | null };

export function procitajTurnir(html: string) {
  const tempoRed = html.match(/<td class="CR">Time control \(([^)]+)\)<\/td><td class="CR">(.*?)<\/td>/i);
  const vrstaRaw = tempoRed ? tempoRed[1].toLowerCase() : "";
  const vrsta = vrstaRaw.includes("blitz") ? "blitz" : vrstaRaw.includes("rapid") ? "rapid" : vrstaRaw ? "standard" : null;
  const datumi = [...(polje(html, "Date") || "").matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`);
  const kola = parseInt(polje(html, "Number of rounds") || "", 10);
  const naslov = html.match(/<h2>([^<]+)<\/h2>/);
  const prijavljeni: Prijavljeni[] = [];
  for (const red of html.split(/<tr class="CRng?[12]/).slice(1)) {
    const ime = red.match(/art=9[^"]*">([^<]+)<\/a>/);
    if (!ime) continue;
    const id = red.match(/fide\.com\/profile\/(\d+)/);
    prijavljeni.push({ n: tekst(ime[1]), f: id ? +id[1] : null });
  }
  return {
    naslov: naslov ? tekst(naslov[1]) : null,
    organizator: polje(html, "Organi[sz]er\\(s\\)"),
    federacija: polje(html, "Federation"),
    mjesto: polje(html, "Location"),
    datum_od: datumi[0] || null,
    datum_do: datumi[1] || datumi[0] || null,
    kola: Number.isFinite(kola) && kola > 0 ? kola : null,
    tempo: tempoRed ? kratkiTempo(tekst(tempoRed[2])) : null,
    vrsta,
    prijavljeni,
  };
}

export function procitajPoredak(html: string) {
  const naslov = html.match(/<h2>((?:Final Ranking|Rank)[^<]*)<\/h2>/i);
  const redovi: { mjesto: number | null; ime: string; bodovi: string | null }[] = [];
  for (const red of html.split(/<tr class="CRg[12]/).slice(1)) {
    const celije = [...red.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => tekst(c[1]));
    const ime = red.match(/art=9[^"]*">([^<]+)<\/a>/);
    if (!ime || !celije.length) continue;
    const bi = celije.findIndex((c, i) => i > 3 && /^\d+(,5)?$/.test(c) && i >= celije.length - 4);
    redovi.push({ mjesto: +celije[0] || null, ime: tekst(ime[1]), bodovi: bi >= 0 ? celije[bi] : null });
  }
  return { konacni: !!naslov && /final/i.test(naslov[1]), redovi };
}

// Dobne skupine i kategorije iz naziva turnira
export function skupine(naziv: string) {
  const n = normaliziraj(naziv);
  const g = new Set<string>();
  for (const m of n.matchAll(/do (\d{1,2}) god/g)) g.add("U" + m[1]);
  for (const m of n.matchAll(/\b(?:u|m|z)-?(\d{1,2})(?![\d:.,])\b/g)) if (+m[1] >= 6 && +m[1] <= 20) g.add("U" + m[1]);
  if (/\bz-?\d{1,2}(?![\d:.,])\b|zensk|djevoj|\bzene\b|women|girls/.test(n)) g.add("zene");
  if (/kadet/.test(n) && ![...g].some((x) => x.startsWith("U"))) g.add("kadeti");
  if (/\bmladi|mlade|juniori|youth/.test(n) && !g.size) g.add("mladi");
  if (/skol|ucenik|ucenic|\bssd\b|\bos\b|\bss\b|\bpuz\b|osnovn|srednj/.test(n)) g.add("skole");
  if (/50\+|65\+|veteran|seniori 50|seniori 65|senior 50|senior 65/.test(n)) g.add("seniori");
  if (!g.size) g.add("open");
  return [...g].sort((a, b) =>
    a[0] === "U" && b[0] === "U" ? +a.slice(1) - +b.slice(1) : a[0] === "U" ? -1 : b[0] === "U" ? 1 : 0
  );
}

// Riječi pisane VELIKIM SLOVIMA → Velikim početnim, osim kratica
const KRATICE = new Set(["HV", "HŠS", "HSS", "KZŽ", "OBŽ", "PGŽ", "DNŽ", "OŠ", "SŠ", "ŠK", "ŠD", "ŠŠD", "ŠS", "PUŽ", "FIDE", "GP", "MO", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV", "XX", "XXX", "A", "B", "C", "D"]);
export function urediNaziv(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\s+-\s+-\s+/g, " – ")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s*$/, "")
    .trim()
    .replace(/[A-ZČĆŽŠĐ]{2,}/g, (w) => (KRATICE.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

// ---------- FIDE ----------

const TITULE: Record<string, string> = {
  Grandmaster: "GM", "International Master": "IM", "FIDE Master": "FM", "Candidate Master": "CM",
  "Woman Grandmaster": "WGM", "Woman International Master": "WIM", "Woman FIDE Master": "WFM", "Woman Candidate Master": "WCM",
};

export function procitajFide(html: string) {
  const broj = (cls: string) => {
    const m = html.match(new RegExp(`profile-${cls} profile-game[^>]*>[\\s\\S]*?<p>(\\d+|Not rated)</p>`));
    return m && /\d/.test(m[1]) ? +m[1] : null;
  };
  const ime = html.match(/<h1 class="player-title">([^<]+)<\/h1>/);
  if (!ime) return null;
  const god = html.match(/profile-info-byear[^>]*>\s*(\d{4})/);
  const titula = html.match(/<h5>FIDE title<\/h5>\s*<div class="profile-info-title[^>]*>\s*<p>([^<]+)<\/p>/);
  const fed = html.match(/profile-info-country[^>]*>[\s\S]*?<\/div>/);
  return {
    fideIme: tekst(ime[1]),
    godina: god ? +god[1] : null,
    titula: titula ? TITULE[tekst(titula[1])] ?? null : null,
    federacija: fed ? tekst(fed[0].replace(/^[^>]*>/, "")) : null,
    rejting: { std: broj("standart"), rapid: broj("rapid"), blitz: broj("blitz") },
  };
}

// FIDE pretraga po imenu: prihvaća samo jednoznačan pogodak (prednost CRO)
export async function nadiFideId(punoIme: string): Promise<number | null> {
  const trazi = kljucImena(punoIme);
  // FIDE imena su bez dijakritika; prezime je obično zadnja riječ
  const rijeci = normaliziraj(punoIme).replace(/[^a-z\s-]/g, "").trim().split(/\s+/).filter((w) => w.length > 1).reverse();
  for (const r of rijeci) {
    const html = await dohvati(`https://ratings.fide.com/incl_search_l.php?search=${encodeURIComponent(r)}&simple=1`, {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://ratings.fide.com/",
    });
    if (!html) continue;
    const pogodci: { id: number; fed: string | null }[] = [];
    for (const red of html.replace(/\s+/g, " ").split("<tr").slice(1)) {
      const m = red.match(/profile\/(\d+) class="found_name">([^<]+)</);
      const fed = red.match(/alt="([A-Z]{3})"/);
      if (m && kljucImena(tekst(m[2])) === trazi) pogodci.push({ id: +m[1], fed: fed ? fed[1] : null });
    }
    const cro = pogodci.filter((p) => p.fed === "CRO");
    if (cro.length === 1) return cro[0].id;
    if (!cro.length && pogodci.length === 1) return pogodci[0].id;
    if (pogodci.length) return null; // više igrača istog imena: ne pogađaj
  }
  return null;
}
