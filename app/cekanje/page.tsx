import Link from "next/link";
import { redirect } from "next/navigation";
import { trenutniKorisnik } from "@/lib/auth";
import { odjava } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function Cekanje() {
  const { user, profil } = await trenutniKorisnik();
  if (!user) redirect("/login");
  if (profil?.odobren) redirect("/");

  return (
    <div className="login">
      <form action={odjava}>
        <h1>Šah<span>.</span></h1>
        <p>Tvoja registracija čeka odobrenje administratora.</p>
        <p className="note">{profil?.ime ? `${profil.ime}, ` : ""}čim te odobri, ovdje se otvara aplikacija. Prijavljen si kao {user.email}.</p>
        <Link className="btn" href="/cekanje" style={{ textAlign: "center", textDecoration: "none" }}>Provjeri ponovno</Link>
        <button className="btn ghost" type="submit">Odjava</button>
      </form>
    </div>
  );
}
