// Poredak, parovi po kolima, kartica igrača i pretraga igrača na chess-results.com.
import { tekst, kljucImena } from "./izvori";

const UA = "Mozilla/5.0 (sah-app)";
export const CR = "https://chess-results.com";
export const turnirUrl = (tnr: number, upit = "") => `${CR}/tnr${tnr}.aspx?lan=1${upit}`;

// GET s predmemorijom na serveru (živi turniri: kratko, završeni: dugo)
async function dohvatiSpremljeno(url: string, sekundi: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      next: { revalidate: sekundi },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// ---------- opće čitanje tablica ----------

type Celija = { t: string; snr: number | null; boja: "b" | "c" | null };
type Tablica = { zaglavlje: string[]; redovi: Celija[][] };

function celije(h: string): Celija[] {
  return [...h.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => {
    let t = tekst(m[1]);
    let boja: Celija["boja"] = null;
    const b = t.match(/^\[([ws])\]\s*/);
    if (b) { boja = b[1] === "w" ? "b" : "c"; t = t.slice(b[0].length); }
    const snr = m[1].match(/snr=(\d+)/);
    return { t, snr: snr ? +snr[1] : null, boja };
  });
}

function tablice(sirovo: string): Tablica[] {
  // Rezultat s bojom je ugniježđena tablica: zamijeni je oznakom boje prije dijeljenja na retke
  const html = sirovo.replace(
    /<table>\s*<tr>\s*<td>\s*<div class="Farbe([ws])T"><\/div>\s*<\/td>\s*<td class="CR">([\s\S]*?)<\/td>\s*<\/tr>\s*<\/table>/g,
    (_, b, r) => `[${b}]${r}`
  );
  const out: Tablica[] = [];
  const dijelovi = html.split(/<tr class="(CRn?g[12]b?)[^"]*">/);
  for (let i = 1; i < dijelovi.length; i += 2) {
    const klasa = dijelovi[i];
    const sadrzaj = dijelovi[i + 1].split(/<\/tr>\s*(?:<\/table>|<tr)/)[0];
    if (klasa.endsWith("b")) out.push({ zaglavlje: celije(sadrzaj).map((c) => c.t), redovi: [] });
    else if (out.length) out[out.length - 1].redovi.push(celije(sadrzaj));
  }
  return out;
}

const stupac = (z: string[], ...imena: string[]) => z.findIndex((h) => imena.some((n) => h === n || (n.endsWith("*") && h.startsWith(n.slice(0, -1)))));
const broj = (s: string | undefined) => (s && /\d/.test(s) ? Number(s.replace(",", ".").replace("½", ".5")) : null);
const kola = (html: string) => Math.max(0, ...[...html.matchAll(/art=2&amp;rd=(\d+)/g)].map((m) => +m[1]));

// ---------- turnir ----------

export type Sudionik = { snr: number; ime: string; titula: string; fide: number | null; rtg: number | null; fed: string; klub: string; kategorija: string };
export type RedPoretka = { mjesto: number | null; snr: number | null; ime: string; titula: string; kategorija: string; rtg: number | null; klub: string; bodovi: string; tb: string[] };
export type Par = { stol: string; bijeli: { snr: number | null; ime: string; rtg: string; bodovi: string }; rezultat: string; crni: { snr: number | null; ime: string; rtg: string; bodovi: string } };

export type TurnirDetalji = {
  tnr: number; naziv: string; info: Record<string, string>;
  sudionici: Sudionik[];
  poredak: RedPoretka[]; naslovPoretka: string | null; konacni: boolean;
  koloParova: number; ukupnoKola: number | null; naslovKola: string | null; parovi: Par[];
};

const INFO = ["Organizer(s)", "Federation", "Director", "Chief Arbiter", "Time control", "Location", "Number of rounds", "Tournament type", "Rating calculation", "Date"];

export async function turnirDetalji(tnr: number, trazenoKolo: number | null, zivo: boolean): Promise<TurnirDetalji | null> {
  const ttl = zivo ? 60 : 3600;
  const [start, poredakHtml] = await Promise.all([
    dohvatiSpremljeno(turnirUrl(tnr, "&art=0&turdet=YES"), ttl),
    dohvatiSpremljeno(turnirUrl(tnr, "&art=1"), ttl),
  ]);
  if (!start) return null;

  const naziv = tekst(start.match(/<h2>([^<]+)<\/h2>/)?.[1] || `Turnir ${tnr}`);
  const info: Record<string, string> = {};
  for (const m of start.matchAll(/<tr><td class="CR">([^<]+)<\/td><td class="CR">(.*?)<\/td><\/tr>/g)) {
    const k = tekst(m[1]);
    if (INFO.some((p) => k.startsWith(p))) info[k] = tekst(m[2]);
  }

  // Startna lista: FIDE ID i kategorija (Typ)
  const sudionici: Sudionik[] = [];
  const ts = tablice(start).find((t) => stupac(t.zaglavlje, "Name") >= 0 && stupac(t.zaglavlje, "No.") >= 0);
  if (ts) {
    const z = ts.zaglavlje, iN = stupac(z, "Name");
    for (const r of ts.redovi) {
      const snr = r[iN]?.snr;
      if (!snr) continue;
      sudionici.push({
        snr, ime: r[iN].t, titula: r[iN - 1]?.t || "",
        fide: broj(r[stupac(z, "FideID")]?.t), rtg: broj(r[stupac(z, "Rtg*")]?.t),
        fed: r[stupac(z, "FED")]?.t || "", klub: r[stupac(z, "Club/City")]?.t || "", kategorija: r[stupac(z, "Typ")]?.t || "",
      });
    }
  }
  const kategorijaSnr = new Map(sudionici.map((s) => [s.snr, s.kategorija]));

  // Poredak
  const poredak: RedPoretka[] = [];
  let naslovPoretka: string | null = null;
  if (poredakHtml) {
    naslovPoretka = tekst(poredakHtml.match(/<h2>((?:Final Ranking|Rank)[^<]*)<\/h2>/i)?.[1] || "") || null;
    const tp = tablice(poredakHtml).find((t) => stupac(t.zaglavlje, "Rk.") >= 0 && stupac(t.zaglavlje, "Name") >= 0);
    if (tp) {
      const z = tp.zaglavlje, iN = stupac(z, "Name"), iP = stupac(z, "Pts.");
      const tbIdx = z.map((h, i) => (/^TB\d/.test(h) ? i : -1)).filter((i) => i >= 0);
      for (const r of tp.redovi) {
        if (!r[iN]) continue;
        const snr = r[iN].snr;
        poredak.push({
          mjesto: broj(r[stupac(z, "Rk.")]?.t), snr, ime: r[iN].t, titula: r[iN - 1]?.t || "",
          kategorija: r[stupac(z, "Typ")]?.t || (snr ? kategorijaSnr.get(snr) || "" : ""),
          rtg: broj(r[stupac(z, "Rtg*")]?.t), klub: r[stupac(z, "Club/City")]?.t || "",
          bodovi: r[iP]?.t || "", tb: tbIdx.map((i) => r[i]?.t || ""),
        });
      }
    }
  }

  // Parovi: traženo kolo ili zadnje objavljeno
  const ukupno = broj(info["Number of rounds"]);
  const objavljeno = Math.max(kola(start), kola(poredakHtml || ""));
  const kolo = trazenoKolo && trazenoKolo >= 1 ? trazenoKolo : objavljeno;
  let parovi: Par[] = [];
  let naslovKola: string | null = null;
  if (kolo >= 1) {
    const ph = await dohvatiSpremljeno(turnirUrl(tnr, `&art=2&rd=${kolo}`), ttl);
    if (ph) {
      naslovKola = tekst(ph.match(/<h3>([^<]*Round[^<]*)<\/h3>/)?.[1] || "") || null;
      const tp = tablice(ph).find((t) => stupac(t.zaglavlje, "White") >= 0);
      if (tp) {
        const z = tp.zaglavlje, iW = stupac(z, "White"), iB = stupac(z, "Black"), iR = stupac(z, "Result");
        const posle = (od: number, ime: string) => z.findIndex((h, i) => i > od && h === ime);
        for (const r of tp.redovi) {
          if (!r[iW]) continue;
          parovi.push({
            stol: r[0]?.t || "",
            bijeli: { snr: r[iW].snr, ime: r[iW].t, rtg: r[posle(iW, "Rtg")]?.t || "", bodovi: r[iR - 1]?.t || "" },
            rezultat: r[iR]?.t || "",
            crni: { snr: r[iB]?.snr ?? null, ime: r[iB]?.t || "", rtg: r[posle(iB, "Rtg")]?.t || "", bodovi: r[iR + 1]?.t || "" },
          });
        }
      }
    }
  }
  parovi = parovi.filter((p) => p.bijeli.ime);

  return {
    tnr, naziv, info, sudionici, poredak, naslovPoretka, konacni: /final/i.test(naslovPoretka || ""),
    koloParova: kolo, ukupnoKola: ukupno ?? (objavljeno || null), naslovKola, parovi,
  };
}

// ---------- kartica igrača u turniru ----------

export type Partija = { kolo: string; stol: string; protivnik: string; protivnikSnr: number | null; titula: string; rtg: string; klub: string; boja: "b" | "c" | null; rezultat: string };
export type Kartica = {
  tnr: number; snr: number; naziv: string; kraj: string | null;
  mjesto: string | null; bodovi: string | null; performansa: string | null; promjena: string | null; rejting: string | null;
  godina: number | null; federacija: string | null;
  partije: Partija[];
};

export async function kartica(tnr: number, snr: number, zivo = false): Promise<Kartica | null> {
  const html = await dohvatiSpremljeno(turnirUrl(tnr, `&art=9&snr=${snr}`), zivo ? 60 : 6 * 3600);
  if (!html) return null;
  const naziv = tekst(html.match(/<h2>([^<]+)<\/h2>/)?.[1] || `Turnir ${tnr}`);
  // Zadnje pojavljivanje: podaci o igraču dolaze ispod podataka o turniru (npr. "Federation")
  const polje = (oznaka: string) => {
    const m = [...html.matchAll(new RegExp(`<td class="CR">${oznaka}\\s*</td><td class="CR">(.*?)</td>`, "g"))].pop();
    return m ? tekst(m[1]) || null : null;
  };
  const datum = html.match(/<td class="CR">Date<\/td><td class="CR">([^<]*)<\/td>/)?.[1];
  const partije: Partija[] = [];
  const tp = tablice(html).find((t) => stupac(t.zaglavlje, "Rd.") >= 0 && stupac(t.zaglavlje, "Name") >= 0);
  if (tp) {
    const z = tp.zaglavlje, iN = stupac(z, "Name"), iR = stupac(z, "Res.");
    for (const r of tp.redovi) {
      if (!r[0]?.t) continue;
      partije.push({
        kolo: r[stupac(z, "Rd.")]?.t || "", stol: r[stupac(z, "Bo.")]?.t || "",
        protivnik: r[iN]?.t || "", protivnikSnr: r[iN]?.snr ?? null, titula: r[iN - 1]?.t || "",
        rtg: r[stupac(z, "Rtg*")]?.t || "", klub: r[stupac(z, "Club/City")]?.t || "",
        boja: r[iR]?.boja ?? null, rezultat: r[iR]?.t || "",
      });
    }
  }
  return {
    tnr, snr, naziv, kraj: datum ? datum.split(" to ").pop()!.replace(/\//g, "-").trim() : null,
    mjesto: polje("Rank"), bodovi: polje("Points"), performansa: polje("Performance rating"),
    promjena: polje("FIDE rtg \\+/-") || polje("Rating \\+/-"), rejting: polje("Rating international") || polje("Rating"),
    godina: broj(polje("Year of birth") ?? undefined), federacija: polje("Federation"),
    partije,
  };
}

// ---------- pretraga igrača (svi turniri na chess-results) ----------

export type NastupIgraca = { tnr: number; snr: number; naziv: string; kraj: string | null; kola: number | null };

type RedPretrage = NastupIgraca & { ime: string; fide: number | null };

// Pretraga igrača na chess-results (ASP.NET obrazac): po FIDE ID-u ili po imenu
async function pretrazi(polja: Record<string, string>): Promise<RedPretrage[]> {
  try {
    const url = `${CR}/SpielerSuche.aspx?lan=1`;
    const r1 = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const forma = await r1.text();
    const kolacic = (r1.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    const akcija = new URL((forma.match(/<form method="post" action="([^"]+)"/)?.[1] || "./SpielerSuche.aspx?lan=1").replace(/&amp;/g, "&"), r1.url).href;
    const tijelo = new URLSearchParams();
    for (const m of forma.matchAll(/<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g)) tijelo.set(m[1], m[2]);
    tijelo.set("ctl00$P1$combo_Sort", "2");
    tijelo.set("ctl00$P1$combo_anzahl_zeilen", "1");
    for (const [k, v] of Object.entries(polja)) tijelo.set(`ctl00$P1$${k}`, v);
    tijelo.set("ctl00$P1$cb_suchen", "Search");
    const r2 = await fetch(akcija, {
      method: "POST", body: tijelo, cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Cookie: kolacic, Referer: r1.url },
    });
    const html = await r2.text();
    const out: RedPretrage[] = [];
    const vidjeno = new Set<number>();
    for (const red of html.split(/<tr class="CRn?g[12]"/).slice(1)) {
      const k = red.match(/tnr(\d+)\.aspx\?lan=1&amp;art=9&amp;snr=(\d+)">([^<]*)</);
      if (!k || vidjeno.has(+k[1])) continue;
      vidjeno.add(+k[1]);
      const c = [...red.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => tekst(m[1]));
      const datum = c.find((x) => /^\d{4}\/\d{2}\/\d{2}$/.test(x));
      const naziv = tekst(red.match(/tnr\d+\.aspx\?lan=1">([^<]*)</)?.[1] || "");
      const iDat = datum ? c.indexOf(datum) : -1;
      out.push({
        tnr: +k[1], snr: +k[2], naziv, kraj: datum ? datum.replace(/\//g, "-") : null, kola: iDat >= 0 ? broj(c[iDat + 2]) : null,
        ime: tekst(k[3]), fide: broj(c[2]) || null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function turniriIgraca(fideId: number): Promise<NastupIgraca[]> {
  return pretrazi({ txt_fideID: String(fideId) });
}

// FIDE ID po imenu (ratings.fide.com ne odgovara Vercelovim serverima): samo jednoznačan pogodak
export async function fideIdPoImenu(punoIme: string): Promise<number | null> {
  const rijeci = punoIme.trim().split(/\s+/);
  if (rijeci.length < 2) return null;
  const trazi = kljucImena(punoIme);
  // "Ime Prezime" ili "Prezime Ime"
  for (const [prezime, ime] of [[rijeci.slice(-1).join(" "), rijeci.slice(0, -1).join(" ")], [rijeci[0], rijeci.slice(1).join(" ")]]) {
    const redovi = await pretrazi({ txt_nachname: prezime, txt_vorname: ime });
    const idovi = new Set(redovi.filter((r) => r.fide && kljucImena(r.ime) === trazi).map((r) => r.fide!));
    if (idovi.size === 1) return [...idovi][0];
    if (idovi.size > 1) return null; // više igrača istog imena: ne pogađaj
  }
  return null;
}

// Vrsta tempa turnira iz zaglavlja na chess-results (pamti se dugo)
async function tempoTurnira(tnr: number): Promise<"standard" | "rapid" | "blitz" | null> {
  const html = await dohvatiSpremljeno(turnirUrl(tnr, "&turdet=YES"), 7 * 86400);
  const m = html?.match(/<td class="CR">Time control \(([^)]+)\)/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return v.includes("blitz") ? "blitz" : v.includes("rapid") ? "rapid" : "standard";
}

export type RejtingIgraca = {
  rejting: { std: number | null; rapid: number | null; blitz: number | null };
  promjena: { std?: number; rapid?: number; blitz?: number };
  godina: number | null; federacija: string | null;
};

// Službeni FIDE rejtinzi s kojima je igrač ušao u zadnje turnire na chess-results,
// za svaki tempo posebno (nadolazeći turniri imaju najnoviju listu)
export async function rejtingIgraca(fideId: number): Promise<RejtingIgraca | null> {
  const nastupi = (await turniriIgraca(fideId)).sort((a, b) => (b.kraj || "").localeCompare(a.kraj || ""));
  if (!nastupi.length) return null;
  const kljuc = { standard: "std", rapid: "rapid", blitz: "blitz" } as const;
  const out: RejtingIgraca = { rejting: { std: null, rapid: null, blitz: null }, promjena: {}, godina: null, federacija: null };
  for (const n of nastupi.slice(0, 15)) {
    if (out.rejting.std && out.rejting.rapid && out.rejting.blitz) break;
    const vrsta = await tempoTurnira(n.tnr);
    if (!vrsta || out.rejting[kljuc[vrsta]]) continue;
    const k = await kartica(n.tnr, n.snr);
    const rtg = broj(k?.rejting ?? undefined);
    if (!k || !rtg) continue;
    out.rejting[kljuc[vrsta]] = rtg;
    const pr = broj(k.promjena ?? undefined);
    if (pr) out.promjena[kljuc[vrsta]] = Math.round(pr);
    out.godina ??= k.godina;
    out.federacija ??= k.federacija;
  }
  return out;
}

// Je li ime iz tablice netko od praćenih igrača
export function prepoznaj(praceni: { id: string; ime: string; fide_id: number | null }[], sudionici: Sudionik[]) {
  const poSnr = new Map<number, string>();
  for (const s of sudionici) {
    const p = praceni.find((x) => (x.fide_id && s.fide === Number(x.fide_id)) || kljucImena(x.ime) === kljucImena(s.ime));
    if (p) poSnr.set(s.snr, p.id);
  }
  return poSnr;
}
