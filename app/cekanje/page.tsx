import { redirect } from "next/navigation";
import { trenutniKorisnik } from "@/lib/auth";
import { odjava } from "../login/actions";

export const dynamic = "force-dynamic";

// Ovamo dolazi korisnik kojeg je administrator blokirao
export default async function Blokiran() {
  const { user, profil } = await trenutniKorisnik();
  if (!user) redirect("/login");
  if (profil?.odobren) redirect("/");

  return (
    <div className="login">
      <form action={odjava}>
        <h1>Šah<span>.</span></h1>
        <p>Tvoj pristup aplikaciji je blokiran.</p>
        <p className="note">Ako misliš da je to greška, javi se administratoru. Prijavljen si kao {user.email}.</p>
        <button className="btn ghost" type="submit">Odjava</button>
      </form>
    </div>
  );
}
