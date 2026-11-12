// Osvježavanje turnira i praćenih igrača (samo na serveru).
// Dohvaćanje s weba radi na kopiji podataka, a promjene se na kraju spajaju u pohranu.
import {
  POPIS_URL, dohvati, paralelno, procitajPopis, procitajTurnir, procitajPoredak, procitajFide,
  nadiFideId, skupine, urediNaziv, kljucImena,
} from "./izvori";
import { citaj, promijeni } from "./pohrana";
import type { Igrac, Rejting, TurnirZapis } from "./tipovi";

const PAMTI_DANA = 120; // završene turnire čuvamo radi rezultata igrača
const ZAKLJUCANO_MS = 2 * 60_000;
const NAJMANJI_RAZMAK_MS = 60_000;

const danas = () => new Date().toISOString().slice(0, 10);
const plusDana = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const turnirUrl = (tnr: number) => `https://chess-results.com/tnr${tnr}.aspx?lan=1`;

// Turniri s popisa hrvatske federacije: novi i oni koji još nisu završili
async function dohvatiTurnire(postojeci: TurnirZapis[]) {
  const popisHtml = await dohvati(POPIS_URL);
  if (!popisHtml) throw new Error("chess-results.com nije dostupan");
  const zavrseni = new Set(postojeci.filter((t) => t.datum_do && t.datum_do < plusDana(danas(), -2)).map((t) => t.tnr));
  const zaCitanje = procitajPopis(popisHtml).filter((t) => !zavrseni.has(t.tnr));

  const novi = await paralelno(zaCitanje, 6, async ({ tnr, naziv }) => {
    const html = await dohvati(`${turnirUrl(tnr)}&turdet=YES`);
    if (!html) return null;
    const d = procitajTurnir(html);
    if (d.federacija && !/CRO/.test(d.federacija)) return null;
    const ime = d.naslov || naziv;
    return {
      tnr, naziv: urediNaziv(ime), url: turnirUrl(tnr), organizator: d.organizator, mjesto: d.mjesto,
      datum_od: d.datum_od, datum_do: d.datum_do, kola: d.kola, tempo: d.tempo, vrsta: d.vrsta,
      skupine: skupine(ime), prijavljeni: d.prijavljeni,
    };
  });

  const poTnr = new Map(postojeci.map((t) => [t.tnr, t]));
  for (const n of novi) if (n) poTnr.set(n.tnr, { rezultati: {}, ...poTnr.get(n.tnr), ...n } as TurnirZapis);
  return [...poTnr.values()].filter((t) => !t.datum_do || t.datum_do >= plusDana(danas(), -PAMTI_DANA));
}

// FIDE profil, prijave i rezultati; vraća ažurirane igrače (turniri dobivaju zapamćene rezultate)
async function dohvatiIgrace(igraci: Igrac[], turniri: TurnirZapis[]) {
  const poredci = new Map<number, Promise<ReturnType<typeof procitajPoredak> | null>>();

  return paralelno(igraci, 3, async (igrac): Promise<Igrac> => {
    const kljucIme = kljucImena(igrac.ime);
    let fideId = igrac.fide_id ? Number(igrac.fide_id) : null;
    if (!fideId) {
      for (const t of turniri) {
        const pogodak = (t.prijavljeni || []).find((p) => p.f && kljucImena(p.n) === kljucIme);
        if (pogodak) { fideId = pogodak.f; break; }
      }
    }
    if (!fideId) fideId = await nadiFideId(igrac.ime);

    const profil = fideId ? await dohvati(`https://ratings.fide.com/profile/${fideId}`).then((h) => (h ? procitajFide(h) : null)) : null;
    const stari = igrac.rejting || {};
    const rejting: Rejting = profil?.rejting ?? stari;
    const promjena: Rejting = { ...igrac.promjena };
    for (const k of ["std", "rapid", "blitz"] as const) {
      const a = stari[k], b = rejting[k];
      if (a && b && a !== b) promjena[k] = b - a;
    }

    const kljuc = fideId ? String(fideId) : kljucIme;
    const fideKljuc = profil ? kljucImena(profil.fideIme) : null;
    const jeOn = (ime: string, f?: number | null) => (!!fideId && f === fideId) || kljucImena(ime) === kljucIme || kljucImena(ime) === fideKljuc;

    const prijave: Igrac["prijave"] = [];
    const nedavno: Igrac["nedavno"] = [];
    for (const t of turniri) {
      if (!(t.prijavljeni || []).some((p) => jeOn(p.n, p.f))) continue;
      if (!t.datum_do || t.datum_do >= danas()) {
        prijave.push({ tnr: t.tnr, naziv: t.naziv, url: turnirUrl(t.tnr), od: t.datum_od });
        continue;
      }
      // Završen turnir: konačni poredak čitamo jednom i pamtimo rezultat
      t.rezultati ||= {};
      if (!t.rezultati[kljuc]) {
        if (!poredci.has(t.tnr)) poredci.set(t.tnr, dohvati(`${turnirUrl(t.tnr)}&art=1`).then((h) => (h ? procitajPoredak(h) : null)));
        const poredak = await poredci.get(t.tnr)!;
        const red = poredak?.redovi.find((r) => jeOn(r.ime));
        if (red && poredak) t.rezultati[kljuc] = { mjesto: red.mjesto, bodovi: red.bodovi, od: poredak.redovi.length };
      }
      const r = t.rezultati[kljuc];
      nedavno.push({ tnr: t.tnr, naziv: t.naziv, url: turnirUrl(t.tnr), do: t.datum_do, rezultat: r ? `${r.bodovi ?? "?"} b · ${r.mjesto ?? "?"}./${r.od}` : null });
    }
    prijave.sort((a, b) => (a.od || "").localeCompare(b.od || ""));
    nedavno.sort((a, b) => (b.do || "").localeCompare(a.do || ""));

    return {
      ...igrac,
      fide_id: fideId,
      titula: profil?.titula ?? igrac.titula,
      godina_rodenja: profil?.godina ?? igrac.godina_rodenja,
      federacija: profil?.federacija ?? igrac.federacija,
      rejting, promjena, prijave, nedavno: nedavno.slice(0, 8),
      napomena: fideId ? null : "FIDE ID nije pronađen ili ima više igrača s tim imenom. Ukloni igrača i dodaj ga ponovno s FIDE ID-om.",
      azurirano: new Date().toISOString(),
    };
  });
}

// Spoji osvježene igrače u pohranu: igrači uklonjeni u međuvremenu ostaju uklonjeni
function spojiIgrace(trenutni: Igrac[], osvjezeni: Igrac[]) {
  const poId = new Map(osvjezeni.map((i) => [i.id, i]));
  return trenutni.map((i) => {
    const o = poId.get(i.id);
    return o ? { ...o, ime: i.ime } : i;
  });
}

// Novi igrač: odmah pronađi FIDE ID, rejting, prijave i rezultate
export async function osvjeziIgraca(id: string) {
  const { podaci } = await citaj();
  const igrac = podaci.igraci.find((i) => i.id === id);
  if (!igrac) return;
  const [osvjezen] = await dohvatiIgrace([igrac], podaci.turniri);
  const rezultati = new Map(podaci.turniri.map((t) => [t.tnr, t.rezultati]));
  await promijeni((p) => {
    p.igraci = spojiIgrace(p.igraci, [osvjezen]);
    for (const t of p.turniri) if (rezultati.has(t.tnr)) t.rezultati = { ...t.rezultati, ...rezultati.get(t.tnr) };
  });
}

// Cijelo osvježavanje; preskače ako je drugo u tijeku ili je upravo završilo
export async function osvjeziSve() {
  const pocetak = new Date().toISOString();
  const smije = await promijeni((p) => {
    const pokrenuto = p.pokrenuto ? Date.parse(p.pokrenuto) : 0;
    const osvjezeno = p.osvjezeno ? Date.parse(p.osvjezeno) : 0;
    if (pokrenuto > osvjezeno && Date.now() - pokrenuto < ZAKLJUCANO_MS) return false;
    if (Date.now() - osvjezeno < NAJMANJI_RAZMAK_MS) return false;
    p.pokrenuto = pocetak;
    return true;
  });
  if (!smije) return { preskoceno: true };

  try {
    const { podaci } = await citaj();
    const turniri = await dohvatiTurnire(podaci.turniri);
    const igraci = await dohvatiIgrace(podaci.igraci, turniri);
    await promijeni((p) => {
      p.turniri = turniri;
      p.igraci = spojiIgrace(p.igraci, igraci);
      p.osvjezeno = new Date().toISOString();
      p.greska = null;
    });
    return { turniri: turniri.length, igraci: igraci.length };
  } catch (e) {
    const greska = e instanceof Error ? e.message : String(e);
    await promijeni((p) => { p.pokrenuto = null; p.greska = greska; });
    throw e;
  }
}
