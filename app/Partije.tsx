import Link from "next/link";
import type { Partija } from "@/lib/sah/chessresults";

// Rezultat iz kuta igrača: pobjeda / remi / poraz / neodigrano
export function Rezultat({ r }: { r: string }) {
  const v = r.trim();
  const vrsta = /^(1|\+)/.test(v) ? "w" : /^(0|-)/.test(v) ? "l" : /½/.test(v) ? "d" : "n";
  return <span className={`res ${vrsta}`}>{v || "–"}</span>;
}

export const Boja = ({ b }: { b: "b" | "c" | null }) =>
  b ? <span className={`boja ${b}`} title={b === "b" ? "bijeli" : "crni"} aria-label={b === "b" ? "bijeli" : "crni"} /> : <span className="boja" />;

export function TablicaPartija({ partije, tnr }: { partije: Partija[]; tnr: number }) {
  if (!partije.length) return <p className="note">Još nema odigranih ni sparenih kola.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Kolo</th><th></th><th>Protivnik</th><th className="num">Rtg</th><th className="num">Rez.</th></tr>
        </thead>
        <tbody>
          {partije.map((p) => (
            <tr key={p.kolo}>
              <td className="num">{p.kolo}</td>
              <td><Boja b={p.boja} /></td>
              <td>
                {p.protivnikSnr
                  ? <Link href={`/turnir/${tnr}?k=poredak&snr=${p.protivnikSnr}`}>{p.titula ? `${p.titula} ` : ""}{p.protivnik}</Link>
                  : p.protivnik || "slobodan"}
                {p.klub && <small className="sub">{p.klub}</small>}
              </td>
              <td className="num">{p.rtg && p.rtg !== "0" ? p.rtg : "–"}</td>
              <td className="num"><Rezultat r={p.rezultat} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
