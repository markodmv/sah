"use client";

import { useState, useTransition } from "react";
import type { Profil } from "@/lib/auth";
import { odobri, oduzmiPristup, ukloni } from "./actions";

const datum = (iso: string) => new Date(iso).toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb" });

export default function Korisnik({ p, naCekanju = false, ja = false }: { p: Profil; naCekanju?: boolean; ja?: boolean }) {
  const [radi, start] = useTransition();
  const [potvrdi, setPotvrdi] = useState(false);

  return (
    <div className="zahtjev">
      <div>
        <b>{p.ime || p.email}</b>{p.admin && <span className="tag age" style={{ marginLeft: 6 }}>admin</span>}
        <div className="p-sub">{p.email} · registriran {datum(p.kreirano)}</div>
      </div>
      {!ja && (
        potvrdi ? (
          <div className="gumbi">
            <button className="btn danger" disabled={radi} onClick={() => start(() => ukloni(p.id))}>{naCekanju ? "Odbij" : "Obriši račun"}</button>
            <button className="btn ghost" disabled={radi} onClick={() => setPotvrdi(false)}>Odustani</button>
          </div>
        ) : naCekanju ? (
          <div className="gumbi">
            <button className="btn" disabled={radi} onClick={() => start(() => odobri(p.id))}>{radi ? "…" : "Odobri"}</button>
            <button className="btn ghost" disabled={radi} onClick={() => setPotvrdi(true)}>Odbij</button>
          </div>
        ) : (
          <div className="gumbi">
            <button className="btn ghost" disabled={radi} onClick={() => start(() => oduzmiPristup(p.id))}>Oduzmi pristup</button>
            <button className="btn ghost" disabled={radi} onClick={() => setPotvrdi(true)}>Obriši</button>
          </div>
        )
      )}
    </div>
  );
}
