import { createClient } from "@/lib/supabase/server";
import Sah, { type Igrac, type Turnir } from "./Sah";

const prijeDana = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export default async function Pocetna() {
  const supabase = await createClient();
  const prijeDvaTjedna = prijeDana(14);

  const [{ data: turniri }, { data: igraci }, { data: stanje }] = await Promise.all([
    supabase
      .from("sah_turniri")
      .select("tnr, naziv, url, organizator, mjesto, datum_od, datum_do, kola, tempo, vrsta, skupine")
      .or(`datum_do.gte.${prijeDvaTjedna},datum_do.is.null`),
    supabase
      .from("sah_igraci")
      .select("id, ime, fide_id, titula, godina_rodenja, federacija, rejting, promjena, prijave, nedavno, napomena, azurirano")
      .order("ime"),
    supabase.from("sah_stanje").select("osvjezeno, pokrenuto, greska").eq("id", 1).maybeSingle(),
  ]);

  return (
    <Sah
      turniri={(turniri ?? []) as Turnir[]}
      igraci={(igraci ?? []) as Igrac[]}
      osvjezeno={stanje?.osvjezeno ?? null}
    />
  );
}
