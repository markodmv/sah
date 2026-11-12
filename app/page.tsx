import { citaj } from "@/lib/sah/pohrana";
import type { Turnir } from "@/lib/sah/tipovi";
import Sah from "./Sah";

export const dynamic = "force-dynamic";

const prijeDana = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export default async function Pocetna() {
  const { podaci } = await citaj();
  const granica = prijeDana(14);
  // Klijentu šaljemo samo ono što se prikazuje (bez startnih lista)
  const turniri: Turnir[] = podaci.turniri
    .filter((t) => !t.datum_do || t.datum_do >= granica)
    .map(({ tnr, naziv, url, organizator, mjesto, datum_od, datum_do, kola, tempo, vrsta, skupine }) =>
      ({ tnr, naziv, url, organizator, mjesto, datum_od, datum_do, kola, tempo, vrsta, skupine }));
  const igraci = [...podaci.igraci].sort((a, b) => a.ime.localeCompare(b.ime, "hr"));

  return <Sah turniri={turniri} igraci={igraci} osvjezeno={podaci.osvjezeno} />;
}
