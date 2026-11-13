"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registracija } from "../login/actions";

export default function RegistracijaPage() {
  const [stanje, formAction, salje] = useActionState(registracija, null);

  return (
    <div className="login">
      <form action={formAction}>
        <h1>Šah<span>.</span></h1>
        <p className="note">Napravi račun i odmah počni pratiti turnire i igrače.</p>
        <label>
          Ime i prezime
          <input className="search" name="ime" required autoComplete="name" />
        </label>
        <label>
          Email
          <input className="search" type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Lozinka (barem 8 znakova)
          <input className="search" type="password" name="password" required minLength={8} autoComplete="new-password" />
        </label>
        {stanje?.greska && <p className="note err">{stanje.greska}</p>}
        <button className="btn" type="submit" disabled={salje}>
          {salje ? "Radim račun..." : "Registriraj se"}
        </button>
        <p className="note">Već imaš račun? <Link href="/login">Prijavi se</Link></p>
      </form>
    </div>
  );
}
