"use client";

import Link from "next/link";
import { useActionState } from "react";
import { prijava } from "./actions";

export default function LoginPage() {
  const [greska, formAction, uPrijavi] = useActionState(prijava, null);

  return (
    <div className="login">
      <form action={formAction}>
        <h1>Šah<span>.</span></h1>
        <p className="note">Šahovski turniri u Hrvatskoj i praćenje igrača.</p>
        <label>
          Email
          <input className="search" type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Lozinka
          <input className="search" type="password" name="password" required autoComplete="current-password" />
        </label>
        {greska && <p className="note err">{greska}</p>}
        <button className="btn" type="submit" disabled={uPrijavi}>
          {uPrijavi ? "Prijava u tijeku..." : "Prijavi se"}
        </button>
        <p className="note">Nemaš račun? <Link href="/registracija">Registriraj se</Link></p>
      </form>
    </div>
  );
}
