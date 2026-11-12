import Link from "next/link";
import { zahtijevajAdmina, type Profil } from "@/lib/auth";
import Korisnik from "./Korisnik";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const { supabase, user } = await zahtijevajAdmina();
  const { data } = await supabase.from("profili").select("id, email, ime, odobren, admin, kreirano").order("kreirano", { ascending: false });
  const profili = (data ?? []) as Profil[];
  const naCekanju = profili.filter((p) => !p.odobren);
  const odobreni = profili.filter((p) => p.odobren);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand"><Link className="natrag" href="/">← Turniri</Link></div>
          <h1 className="naslov-turnira">Korisnici</h1>
        </div>
      </header>
      <main className="wrap sadrzaj">
        <section className="view">
          <div className="month">
            <h2>Čekaju odobrenje · {naCekanju.length}</h2>
            <div className="list">
              {naCekanju.length ? naCekanju.map((p) => <Korisnik key={p.id} p={p} naCekanju />) : <div className="empty">Nema novih registracija.</div>}
            </div>
          </div>
          <div className="month">
            <h2>Odobreni · {odobreni.length}</h2>
            <div className="list">
              {odobreni.map((p) => <Korisnik key={p.id} p={p} ja={p.id === user.id} />)}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
