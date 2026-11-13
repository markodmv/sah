"use client";

import { useState, useTransition } from "react";
import type { Profil } from "@/lib/auth";
import { blokiraj, obrisi, odblokiraj } from "./actions";

export type Statistika = { zadnje: string | null; danas: number; tjedan: number; ukupno: number; posjete: number; dana: number };

const datum = (iso: string) => new Date(iso).toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb" });
const vrijeme = (iso: string) => new Date(iso).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const trajanje = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

export default function Korisnik({ p, s, ja = false }: { p: Profil; s: Statistika | null; ja?: boolean }) {
  const [radi, start] = useTransition();
  const [potvrdi, setPotvrdi] = useState(false);

  return (
    <article className="p korisnik">
      <div className="p-head">
        <div>
          <h2 className="p-name">{p.ime || p.email}{p.admin && <span className="tag age" style={{ marginLeft: 8, verticalAlign: "middle" }}>admin</span>}</h2>
          <div className="p-sub">{p.email} · registriran {datum(p.kreirano)}</div>
        </div>
      </div>
      <div className="ratings">
        <div className="r"><small>Danas</small><b>{s?.danas ?? 0}</b><i>min</i></div>
        <div className="r"><small>7 dana</small><b>{s?.tjedan ?? 0}</b><i>min</i></div>
        <div className="r"><small>Posjete</small><b>{s?.posjete ?? 0}</b><i>{s?.dana ?? 0} dana</i></div>
      </div>
      <p className="note">
        {s?.zadnje ? `Zadnje u aplikaciji ${vrijeme(s.zadnje)} · ukupno ${trajanje(s.ukupno)}` : "Još nije bio u aplikaciji."}
      </p>
      {!ja && (
        potvrdi ? (
          <div className="confirm">
            Obrisati račun {p.ime || p.email}? Brišu se i njegovi praćeni igrači.
            <button className="btn danger" disabled={radi} onClick={() => start(() => obrisi(p.id))}>Obriši</button>
            <button className="btn ghost" disabled={radi} onClick={() => setPotvrdi(false)}>Odustani</button>
          </div>
        ) : (
          <div className="row gumbi">
            {p.odobren
              ? <button className="btn ghost" disabled={radi} onClick={() => start(() => blokiraj(p.id))}>{radi ? "…" : "Blokiraj"}</button>
              : <button className="btn" disabled={radi} onClick={() => start(() => odblokiraj(p.id))}>{radi ? "…" : "Odblokiraj"}</button>}
            <button className="btn ghost" disabled={radi} onClick={() => setPotvrdi(true)}>Obriši</button>
          </div>
        )
      )}
    </article>
  );
}
