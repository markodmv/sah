import Link from "next/link";
import { zahtijevajAdmina, type Profil } from "@/lib/auth";
import Korisnik, { type Statistika } from "./Korisnik";

export const dynamic = "force-dynamic";

type Red = { korisnik_id: string; dan: string; posjete: number; minute: number; zadnje: string };

const danUZagrebu = (pomak = 0) => new Date(Date.now() - pomak * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });

export default async function Admin() {
  const { supabase, user } = await zahtijevajAdmina();
  const [{ data }, { data: akt, error: greskaAkt }] = await Promise.all([
    supabase.from("profili").select("id, email, ime, odobren, admin, kreirano"),
    supabase.from("aktivnost").select("korisnik_id, dan, posjete, minute, zadnje"),
  ]);
  const profili = (data ?? []) as Profil[];

  // Zbroj aktivnosti po korisniku
  const danas = danUZagrebu(), prijeTjedan = danUZagrebu(6);
  const stat = new Map<string, Statistika>();
  for (const r of (akt ?? []) as Red[]) {
    const s = stat.get(r.korisnik_id) ?? { zadnje: null, danas: 0, tjedan: 0, ukupno: 0, posjete: 0, dana: 0 };
    if (!s.zadnje || r.zadnje > s.zadnje) s.zadnje = r.zadnje;
    if (r.dan === danas) s.danas += r.minute;
    if (r.dan >= prijeTjedan) s.tjedan += r.minute;
    s.ukupno += r.minute;
    s.posjete += r.posjete;
    s.dana += 1;
    stat.set(r.korisnik_id, s);
  }
  const zadnje = (p: Profil) => stat.get(p.id)?.zadnje ?? "";
  const poAktivnosti = (a: Profil, b: Profil) => zadnje(b).localeCompare(zadnje(a)) || b.kreirano.localeCompare(a.kreirano);
  const aktivni = profili.filter((p) => p.odobren).sort(poAktivnosti);
  const blokirani = profili.filter((p) => !p.odobren).sort(poAktivnosti);
  const danasAktivnih = [...stat.values()].filter((s) => s.danas > 0).length;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand"><Link className="natrag" href="/">← Turniri</Link></div>
          <h1 className="naslov-turnira">Korisnici</h1>
          <div className="t-meta">{profili.length} registriranih · danas aktivno {danasAktivnih}</div>
        </div>
      </header>
      <main className="wrap sadrzaj">
        <section className="view">
          {greskaAkt && <p className="note err">Aktivnost se još ne bilježi: u Supabaseu pokreni SQL 0002_aktivnost.sql.</p>}
          <div className="month">
            <h2>Korisnici · {aktivni.length}</h2>
            <div className="list">
              {aktivni.map((p) => <Korisnik key={p.id} p={p} s={stat.get(p.id) ?? null} ja={p.id === user.id} />)}
            </div>
          </div>
          {blokirani.length > 0 && (
            <div className="month">
              <h2>Blokirani · {blokirani.length}</h2>
              <div className="list">
                {blokirani.map((p) => <Korisnik key={p.id} p={p} s={stat.get(p.id) ?? null} />)}
              </div>
            </div>
          )}
          <p className="note">Minute se broje dok je aplikacija otvorena na ekranu. Nova posjeta je dolazak nakon barem pola sata stanke.</p>
        </section>
      </main>
    </>
  );
}
