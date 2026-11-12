"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registracija } from "../login/actions";

export default function RegistracijaPage() {
  const [stanje, formAction, salje] = useActionState(registracija, null);

  if (stanje?.poslano) {
    return (
      <div className="login">
        <form>
          <h1>Šah<span>.</span></h1>
          <p>Poslali smo ti email. Otvori poveznicu u njemu da potvrdiš adresu.</p>
          <p className="note">Nakon toga registraciju mora odobriti administrator. Kad je odobri, prijavi se i aplikacija je tvoja.</p>
          <p className="note"><Link href="/login">Natrag na prijavu</Link></p>
        </form>
      </div>
    );
  }

  return (
    <div className="login">
      <form action={formAction}>
        <h1>Šah<span>.</span></h1>
        <p className="note">Registracija. Prije korištenja administrator mora odobriti tvoj račun.</p>
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
          {salje ? "Šaljem..." : "Registriraj se"}
        </button>
        <p className="note">Već imaš račun? <Link href="/login">Prijavi se</Link></p>
      </form>
    </div>
  );
}
