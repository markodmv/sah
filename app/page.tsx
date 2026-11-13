import { zahtijevajOdobrenog } from "@/lib/auth";
import type { Igrac, Turnir } from "@/lib/sah/tipovi";
import Sah from "./Sah";

export const dynamic = "force-dynamic";

const prijeDana = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export default async function Pocetna() {
  const { supabase, profil } = await zahtijevajOdobrenog();

  const [{ data: turniri }, { data: igraci }, { data: stanje }] = await Promise.all([
    supabase
      .from("turniri")
      .select("tnr, naziv, url, organizator, mjesto, datum_od, datum_do, kola, tempo, vrsta, skupine")
      .or(`datum_do.gte.${prijeDana(14)},datum_do.is.null`),
    supabase
      .from("igraci")
      .select("id, ime, fide_id, titula, godina_rodenja, federacija, rejting, promjena, prijave, nedavno, napomena, azurirano")
      .order("ime"),
    supabase.from("stanje").select("osvjezeno").eq("id", 1).maybeSingle(),
  ]);

  return (
    <Sah
      turniri={(turniri ?? []) as Turnir[]}
      igraci={(igraci ?? []) as Igrac[]}
      osvjezeno={stanje?.osvjezeno ?? null}
      korisnik={{ ime: profil.ime || profil.email, admin: profil.admin }}
    />
  );
}
