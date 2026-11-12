// Osvježavanje turnira i praćenih igrača. Radi sa service role klijentom (samo na serveru).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  POPIS_URL, dohvati, paralelno, procitajPopis, procitajTurnir, procitajPoredak, procitajFide,
  nadiFideId, skupine, urediNaziv, kljucImena, type Prijavljeni,
} from "./izvori";

const PAMTI_DANA = 120; // završene turnire čuvamo radi rezultata igrača
const ZAKLJUCANO_MS = 2 * 60_000;

const danas = () => new Date().toISOString().slice(0, 10);
const plusDana = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const turnirUrl = (tnr: number) => `https://chess-results.com/tnr${tnr}.aspx?lan=1`;

type Rejting = { std: number | null; rapid: number | null; blitz: number | null };
type IgracRed = {
  id: string; ime: string; fide_id: number | null; rejting: Partial<Rejting>; promjena: Partial<Rejting>;
  titula: string | null; godina_rodenja: number | null; federacija: string | null;
};
type TurnirRed = {
  tnr: number; naziv: string; datum_od: string | null; datum_do: string | null;
  prijavljeni: Prijavljeni[]; rezultati: Record<string, { mjesto: number | null; bodovi: string | null; od: number }>;
};

// Turniri s popisa hrvatske federacije: novi i oni koji još nisu završili
async function osvjeziTurnire(db: SupabaseClient) {
  const popisHtml = await dohvati(POPIS_URL);
  if (!popisHtml) throw new Error("chess-results.com nije dostupan");
  const popis = procitajPopis(popisHtml);

  const { data: postojeci } = await db.from("sah_turniri").select("tnr, datum_do");
  const zavrseni = new Set((postojeci ?? []).filter((t) => t.datum_do && t.datum_do < plusDana(danas(), -2)).map((t) => t.tnr));
  const zaCitanje = popis.filter((t) => !zavrseni.has(t.tnr));

  const redovi = (
    await paralelno(zaCitanje, 6, async ({ tnr, naziv }) => {
      const html = await dohvati(`${turnirUrl(tnr)}&turdet=YES`);
      if (!html) return null;
      const d = procitajTurnir(html);
      if (d.federacija && !/CRO/.test(d.federacija)) return null;
      const ime = d.naslov || naziv;
      return {
        tnr, naziv: urediNaziv(ime), url: turnirUrl(tnr), organizator: d.organizator, mjesto: d.mjesto,
        datum_od: d.datum_od, datum_do: d.datum_do, kola: d.kola, tempo: d.tempo, vrsta: d.vrsta,
        skupine: skupine(ime), prijavljeni: d.prijavljeni, azurirano: new Date().toISOString(),
      };
    })
  ).filter((r) => r !== null);

  if (redovi.length) {
    const { error } = await db.from("sah_turniri").upsert(redovi, { onConflict: "tnr" });
    if (error) throw new Error(error.message);
  }
  await db.from("sah_turniri").delete().lt("datum_do", plusDana(danas(), -PAMTI_DANA));
  return redovi.length;
}

// FIDE profil, prijave i rezultati za zadane igrače
export async function osvjeziIgrace(db: SupabaseClient, igraci: IgracRed[]) {
  if (!igraci.length) return 0;
  const { data } = await db
    .from("sah_turniri")
    .select("tnr, naziv, datum_od, datum_do, prijavljeni, rezultati")
    .gte("datum_do", plusDana(danas(), -PAMTI_DANA));
  const turniri = (data ?? []) as TurnirRed[];
  const promijenjeniRezultati = new Set<TurnirRed>();
  const poredci = new Map<number, Promise<ReturnType<typeof procitajPoredak> | null>>();

  await paralelno(igraci, 3, async (igrac) => {
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
    const rejting: Rejting = profil?.rejting ?? { std: igrac.rejting.std ?? null, rapid: igrac.rejting.rapid ?? null, blitz: igrac.rejting.blitz ?? null };
    const promjena: Partial<Rejting> = { ...igrac.promjena };
    for (const k of ["std", "rapid", "blitz"] as const) {
      const a = igrac.rejting[k], b = rejting[k];
      if (a && b && a !== b) promjena[k] = b - a;
    }

    const kljuc = fideId ? String(fideId) : kljucIme;
    const fideKljuc = profil ? kljucImena(profil.fideIme) : null;
    const jeOn = (ime: string, f?: number | null) => (fideId && f === fideId) || kljucImena(ime) === kljucIme || kljucImena(ime) === fideKljuc;

    const prijave: { tnr: number; naziv: string; url: string; od: string | null }[] = [];
    const nedavno: { tnr: number; naziv: string; url: string; do: string | null; rezultat: string | null }[] = [];
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
        if (red && poredak) {
          t.rezultati[kljuc] = { mjesto: red.mjesto, bodovi: red.bodovi, od: poredak.redovi.length };
          promijenjeniRezultati.add(t);
        }
      }
      const r = t.rezultati[kljuc];
      nedavno.push({ tnr: t.tnr, naziv: t.naziv, url: turnirUrl(t.tnr), do: t.datum_do, rezultat: r ? `${r.bodovi ?? "?"} b · ${r.mjesto ?? "?"}./${r.od}` : null });
    }
    prijave.sort((a, b) => (a.od || "").localeCompare(b.od || ""));
    nedavno.sort((a, b) => (b.do || "").localeCompare(a.do || ""));

    await db.from("sah_igraci").update({
      fide_id: fideId,
      titula: profil?.titula ?? igrac.titula,
      godina_rodenja: profil?.godina ?? igrac.godina_rodenja,
      federacija: profil?.federacija ?? igrac.federacija,
      rejting, promjena, prijave, nedavno: nedavno.slice(0, 8),
      napomena: fideId ? null : "FIDE ID nije pronađen ili ima više igrača s tim imenom. Ukloni igrača i dodaj ga ponovno s FIDE ID-om.",
      azurirano: new Date().toISOString(),
    }).eq("id", igrac.id);
  });

  for (const t of promijenjeniRezultati) {
    await db.from("sah_turniri").update({ rezultati: t.rezultati }).eq("tnr", t.tnr);
  }
  return igraci.length;
}

const POLJA_IGRACA = "id, ime, fide_id, rejting, promjena, titula, godina_rodenja, federacija";

export async function dohvatiIgrace(db: SupabaseClient, idovi?: string[]) {
  let q = db.from("sah_igraci").select(POLJA_IGRACA);
  if (idovi) q = q.in("id", idovi);
  const { data } = await q;
  return (data ?? []) as IgracRed[];
}

// Cijelo osvježavanje; preskače ako je drugo upravo u tijeku
export async function osvjeziSve(db: SupabaseClient) {
  const { data: stanje } = await db.from("sah_stanje").select("osvjezeno, pokrenuto").eq("id", 1).single();
  const pokrenuto = stanje?.pokrenuto ? Date.parse(stanje.pokrenuto) : 0;
  const osvjezeno = stanje?.osvjezeno ? Date.parse(stanje.osvjezeno) : 0;
  if (pokrenuto > osvjezeno && Date.now() - pokrenuto < ZAKLJUCANO_MS) return { preskoceno: true };

  await db.from("sah_stanje").update({ pokrenuto: new Date().toISOString() }).eq("id", 1);
  try {
    const turniri = await osvjeziTurnire(db);
    const igraci = await osvjeziIgrace(db, await dohvatiIgrace(db));
    await db.from("sah_stanje").update({ osvjezeno: new Date().toISOString(), greska: null }).eq("id", 1);
    return { turniri, igraci };
  } catch (e) {
    const greska = e instanceof Error ? e.message : String(e);
    // osvjezeno ostaje staro, ali otključaj
    await db.from("sah_stanje").update({ pokrenuto: null, greska }).eq("id", 1);
    throw e;
  }
}
