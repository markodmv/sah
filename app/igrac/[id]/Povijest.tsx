"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Kartica, NastupIgraca } from "@/lib/sah/chessresults";
import { TablicaPartija } from "../../Partije";
import { ljepsiNaziv } from "@/lib/sah/prikaz";

const datum = (iso: string | null) => { if (!iso) return ""; const [, m, d] = iso.split("-"); return `${+d}. ${+m}.`; };
const danas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });

export default function Povijest({ nastupi }: { nastupi: NastupIgraca[] }) {
  const poGodinama = useMemo(() => {
    const m = new Map<string, NastupIgraca[]>();
    for (const n of nastupi) {
      const g = n.kraj?.slice(0, 4) || "Bez datuma";
      m.set(g, [...(m.get(g) || []), n]);
    }
    return [...m].sort((a, b) => b[0].localeCompare(a[0]));
  }, [nastupi]);
  const [godina, setGodina] = useState(poGodinama[0]?.[0] ?? "");
  const lista = poGodinama.find(([g]) => g === godina)?.[1] ?? [];

  return (
    <section className="view">
      <div className="chips" role="group" aria-label="Godina">
        {poGodinama.map(([g, l]) => (
          <button key={g} className="chip" aria-pressed={g === godina} onClick={() => setGodina(g)}>{g} · {l.length}</button>
        ))}
      </div>
      <div className="list">
        {lista.map((n, i) => <Nastup key={n.tnr} n={n} otvoren={i === 0} />)}
      </div>
      <p className="note">Izvor: pretraga igrača na chess-results.com. Dodirni turnir za tablicu partija.</p>
    </section>
  );
}

function Nastup({ n, otvoren }: { n: NastupIgraca; otvoren: boolean }) {
  const [open, setOpen] = useState(otvoren);
  const [k, setK] = useState<Kartica | null>(null);
  const [greska, setGreska] = useState(false);
  const buduci = !!n.kraj && n.kraj >= danas();
  // Prije prvog kola chess-results kao "mjesto" pokazuje startni broj, pa rezultat prikazujemo tek kad ima odigranih partija
  const odigrano = !!k?.partije.some((p) => p.rezultat.trim());

  // Kartica se učitava odmah (puni naziv, mjesto i bodovi), a partije se prikazuju na dodir
  useEffect(() => {
    if (k || greska) return;
    let prekid = false;
    fetch(`/api/kartica?tnr=${n.tnr}&snr=${n.snr}${buduci ? "&zivo=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Kartica) => { if (!prekid) setK(d); })
      .catch(() => { if (!prekid) setGreska(true); });
    return () => { prekid = true; };
  }, [k, greska, n.tnr, n.snr, buduci]);

  return (
    <article className="p nastup">
      <button className="nastup-glava" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="nastup-datum">{datum(n.kraj)}</span>
        <span className="nastup-naziv">{ljepsiNaziv(k?.naziv || n.naziv)}</span>
        <span className="nastup-rez">
          {odigrano ? (
            <>
              {k?.mjesto && <b>{k.mjesto}.</b>}
              {k?.bodovi && <span>{k.bodovi} b</span>}
            </>
          ) : buduci ? <span className="tag live">prijavljen</span> : null}
        </span>
      </button>
      {open && (
        greska ? <p className="note err">Kartica se ne može učitati.</p>
        : !k ? <p className="note">Učitavam partije…</p>
        : (
          <>
            {(k.performansa || k.promjena) && (
              <div className="p-sub">
                {[k.performansa && k.performansa !== "0" ? `Performansa ${k.performansa}` : null, k.promjena ? `Rejting ${/^-/.test(k.promjena) ? "" : "+"}${k.promjena}` : null].filter(Boolean).join(" · ")}
              </div>
            )}
            <TablicaPartija partije={k.partije} tnr={n.tnr} />
            <div className="links">
              <Link href={`/turnir/${n.tnr}?k=poredak&snr=${n.snr}`}>Cijela tablica i parovi</Link>
            </div>
          </>
        )
      )}
    </article>
  );
}
