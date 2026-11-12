import Link from "next/link";
import { notFound } from "next/navigation";
import { zahtijevajOdobrenog } from "@/lib/auth";
import { kartica, prepoznaj, turnirDetalji, turnirUrl } from "@/lib/sah/chessresults";
import TurnirPrikaz from "./TurnirPrikaz";

export const dynamic = "force-dynamic";

const danas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });

export default async function TurnirStranica({ params, searchParams }: PageProps<"/turnir/[tnr]">) {
  const { tnr: tnrTekst } = await params;
  const upit = await searchParams;
  const tnr = Number(tnrTekst);
  if (!Number.isInteger(tnr) || tnr <= 0) notFound();

  const { supabase } = await zahtijevajOdobrenog();
  const [{ data: sviTurniri }, { data: mojiIgraci }] = await Promise.all([
    supabase.from("turniri").select("tnr, naziv, datum_od, datum_do"),
    supabase.from("igraci").select("id, ime, fide_id"),
  ]);
  const podaci = { turniri: sviTurniri ?? [], igraci: mojiIgraci ?? [] };
  const spremljen = podaci.turniri.find((t) => t.tnr === tnr);
  const d = danas();
  const zivo = !!spremljen?.datum_od && spremljen.datum_od <= d && (!spremljen.datum_do || spremljen.datum_do >= d);

  const kolo = Number(upit.kolo) || null;
  const detalji = await turnirDetalji(tnr, kolo, zivo);
  if (!detalji) {
    return (
      <main className="wrap sadrzaj">
        <Link className="natrag" href="/">← Turniri</Link>
        <div className="empty">Turnir se trenutno ne može učitati s chess-results.com. <a href={turnirUrl(tnr)} target="_blank" rel="noopener">Otvori na chess-results.com</a></div>
      </main>
    );
  }

  // Praćeni igrači u ovom turniru i njihove partije
  const nasi = prepoznaj(podaci.igraci, detalji.sudionici);
  const kartice = (
    await Promise.all([...nasi].map(async ([snr, id]) => {
      const k = await kartica(tnr, snr, zivo);
      const igrac = podaci.igraci.find((i) => i.id === id);
      return k && igrac ? { igrac: { id, ime: igrac.ime }, kartica: k } : null;
    }))
  ).filter((x) => x !== null);

  // Prvenstva su na chess-results često razdvojena po kategorijama ("… :: dječaci U10 ::")
  const osnova = (n: string) => n.split("::")[0].trim();
  const oznakaKategorije = (n: string) => n.split("::")[1]?.trim() || "";
  const ovaj = spremljen?.naziv || detalji.naziv;
  const kategorijeDogadaja = oznakaKategorije(ovaj)
    ? podaci.turniri
        .filter((t) => osnova(t.naziv) === osnova(ovaj) && oznakaKategorije(t.naziv))
        .map((t) => ({ tnr: t.tnr, oznaka: oznakaKategorije(t.naziv) }))
        .sort((a, b) => a.oznaka.localeCompare(b.oznaka, "hr", { numeric: true }))
    : [];

  return (
    <TurnirPrikaz
      d={detalji}
      kategorijeDogadaja={kategorijeDogadaja}
      zivo={zivo}
      datumi={spremljen ? { od: spremljen.datum_od, do: spremljen.datum_do } : null}
      nasiSnr={[...nasi.keys()]}
      kartice={kartice}
      pocetnaKartica={typeof upit.k === "string" ? upit.k : null}
      oznaciSnr={Number(upit.snr) || null}
    />
  );
}
