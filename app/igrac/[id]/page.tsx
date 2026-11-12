import Link from "next/link";
import { notFound } from "next/navigation";
import { citaj } from "@/lib/sah/pohrana";
import { turniriIgraca } from "@/lib/sah/chessresults";
import Povijest from "./Povijest";

export const dynamic = "force-dynamic";

export default async function IgracStranica({ params }: PageProps<"/igrac/[id]">) {
  const { id } = await params;
  const { podaci } = await citaj();
  const igrac = podaci.igraci.find((i) => i.id === id);
  if (!igrac) notFound();

  const nastupi = igrac.fide_id ? await turniriIgraca(Number(igrac.fide_id)) : [];
  const r = igrac.rejting || {};

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand"><Link className="natrag" href="/#igraci">← Igrači</Link></div>
          <h1 className="naslov-turnira">{igrac.titula ? `${igrac.titula} ` : ""}{igrac.ime}</h1>
          <div className="t-meta">
            {[igrac.fide_id ? `FIDE ${igrac.fide_id}` : null, igrac.godina_rodenja ? `rođ. ${igrac.godina_rodenja}` : null,
              r.std ? `Std ${r.std}` : null, r.rapid ? `Ubrz. ${r.rapid}` : null, r.blitz ? `Brzop. ${r.blitz}` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
      </header>
      <main className="wrap sadrzaj">
        {!igrac.fide_id ? (
          <div className="empty">Povijest turnira traži FIDE ID igrača. Ukloni igrača i dodaj ga ponovno s FIDE ID-om.</div>
        ) : !nastupi.length ? (
          <div className="empty">Na chess-results.com nema turnira za ovog igrača ili pretraga trenutno ne radi.</div>
        ) : (
          <Povijest nastupi={nastupi} />
        )}
      </main>
    </>
  );
}
