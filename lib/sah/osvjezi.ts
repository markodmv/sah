// Osvježavanje turnira i praćenih igrača (samo na serveru).
// Dohvaćanje s weba radi na kopiji podataka, a promjene se na kraju spremaju u Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  POPIS_URL, dohvati, paralelno, procitajPopis, procitajTurnir, procitajPoredak,
  skupine, urediNaziv, kljucImena,
} from "./izvori";
import { fideIdPoImenu, rejtingIgraca } from "./chessresults";
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

// FIDE ID, rejting, prijave i rezultati; vraća ažurirane igrače (turniri dobivaju zapamćene rezultate)
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
    if (!fideId) fideId = await fideIdPoImenu(igrac.ime);

    // ratings.fide.com ne odgovara Vercelovim serverima, pa rejting uzimamo s chess-results:
    // službeni FIDE rejting s kojim je igrač ušao u zadnji turnir svakog tempa
    const cr = fideId ? await rejtingIgraca(fideId) : null;
    const stari = igrac.rejting || {};
    const rejting: Rejting = {
      std: cr?.rejting.std ?? stari.std ?? null,
      rapid: cr?.rejting.rapid ?? stari.rapid ?? null,
      blitz: cr?.rejting.blitz ?? stari.blitz ?? null,
    };
    const promjena: Rejting = cr ? cr.promjena : { ...igrac.promjena };
    const profil = cr ? { godina: cr.godina, federacija: cr.federacija, titula: null } : null;

    const kljuc = fideId ? String(fideId) : kljucIme;
    const jeOn = (ime: string, f?: number | null) => (!!fideId && f === fideId) || kljucImena(ime) === kljucIme;

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
      federacija: profil?.federacija ? (/CRO/.test(profil.federacija) ? "Hrvatska" : profil.federacija) : igrac.federacija,
      rejting, promjena, prijave, nedavno: nedavno.slice(0, 8),
      napomena: fideId ? null : "FIDE ID nije pronađen ili ima više igrača s tim imenom. Ukloni igrača i dodaj ga ponovno s FIDE ID-om.",
      azurirano: new Date().toISOString(),
    };
  });
}

// ---------- spremanje u Supabase (service role) ----------

const POLJA_TURNIRA = "tnr, naziv, url, organizator, mjesto, datum_od, datum_do, kola, tempo, vrsta, skupine, prijavljeni, rezultati";
const POLJA_IGRACA = "id, ime, fide_id, titula, godina_rodenja, federacija, rejting, promjena, prijave, nedavno, napomena, azurirano";

async function ucitajTurnire(db: SupabaseClient) {
  const { data, error } = await db.from("turniri").select(POLJA_TURNIRA);
  if (error) throw new Error(error.message);
  return (data ?? []) as TurnirZapis[];
}

async function spremiIgrace(db: SupabaseClient, igraci: Igrac[]) {
  await paralelno(igraci, 5, async ({ id, ...polja }) => {
    await db.from("igraci").update(polja).eq("id", id);
  });
}

// Spremi samo rezultate koji su se promijenili tijekom osvježavanja
async function spremiRezultate(db: SupabaseClient, turniri: TurnirZapis[], prije: Map<number, string>) {
  const promijenjeni = turniri.filter((t) => JSON.stringify(t.rezultati || {}) !== prije.get(t.tnr));
  await paralelno(promijenjeni, 5, async (t) => {
    await db.from("turniri").update({ rezultati: t.rezultati }).eq("tnr", t.tnr);
  });
}

const snimkaRezultata = (turniri: TurnirZapis[]) => new Map(turniri.map((t) => [t.tnr, JSON.stringify(t.rezultati || {})]));

// Novi igrač: odmah pronađi FIDE ID, rejting, prijave i rezultate
export async function osvjeziIgraca(id: string) {
  const db = createAdminClient();
  const { data } = await db.from("igraci").select(POLJA_IGRACA).eq("id", id).maybeSingle();
  if (!data) return;
  const turniri = await ucitajTurnire(db);
  const prije = snimkaRezultata(turniri);
  await spremiIgrace(db, await dohvatiIgrace([data as Igrac], turniri));
  await spremiRezultate(db, turniri, prije);
}

// Cijelo osvježavanje; preskače ako je drugo u tijeku ili je upravo završilo
export async function osvjeziSve() {
  const db = createAdminClient();
  const { data: s } = await db.from("stanje").select("osvjezeno, pokrenuto").eq("id", 1).maybeSingle();
  const pokrenuto = s?.pokrenuto ? Date.parse(s.pokrenuto) : 0;
  const osvjezeno = s?.osvjezeno ? Date.parse(s.osvjezeno) : 0;
  if (pokrenuto > osvjezeno && Date.now() - pokrenuto < ZAKLJUCANO_MS) return { preskoceno: true };
  if (Date.now() - osvjezeno < NAJMANJI_RAZMAK_MS) return { preskoceno: true };
  await db.from("stanje").upsert({ id: 1, pokrenuto: new Date().toISOString() });

  try {
    const stari = await ucitajTurnire(db);
    const turniri = await dohvatiTurnire(stari);
    const prije = snimkaRezultata(turniri);
    const { data: igraciData } = await db.from("igraci").select(POLJA_IGRACA);
    const igraci = await dohvatiIgrace((igraciData ?? []) as Igrac[], turniri);

    const { error } = await db.from("turniri").upsert(turniri.map((t) => ({ ...t, azurirano: new Date().toISOString() })), { onConflict: "tnr" });
    if (error) throw new Error(error.message);
    await db.from("turniri").delete().lt("datum_do", plusDana(danas(), -PAMTI_DANA));
    await spremiIgrace(db, igraci);
    await spremiRezultate(db, turniri, prije);
    await db.from("stanje").update({ osvjezeno: new Date().toISOString(), greska: null }).eq("id", 1);
    return { turniri: turniri.length, igraci: igraci.length };
  } catch (e) {
    const greska = e instanceof Error ? e.message : String(e);
    await db.from("stanje").update({ pokrenuto: null, greska }).eq("id", 1);
    throw e;
  }
}
