"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Kartica, TurnirDetalji } from "@/lib/sah/chessresults";
import { turnirUrl } from "@/lib/sah/chessresults";
import { TablicaPartija } from "../../Partije";
import { ljepsiNaziv } from "@/lib/sah/prikaz";

type Props = {
  d: TurnirDetalji;
  kategorijeDogadaja: { tnr: number; oznaka: string }[];
  zivo: boolean;
  datumi: { od: string | null; do: string | null } | null;
  nasiSnr: number[];
  kartice: { igrac: { id: string; ime: string }; kartica: Kartica }[];
  pocetnaKartica: string | null;
  oznaciSnr: number | null;
};

const OSVJEZI_ZIVO_MS = 60_000;

// U08 < U10 < … < U20, zatim ostalo abecedno
const redKategorije = (a: string, b: string) => {
  const na = a.match(/\d+/)?.[0], nb = b.match(/\d+/)?.[0];
  if (na && nb && +na !== +nb) return +na - +nb;
  return a.localeCompare(b, "hr");
};

const datum = (iso: string | null) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${+d}. ${+m}. ${y}.`; };

export default function TurnirPrikaz({ d, kategorijeDogadaja, zivo, datumi, nasiSnr, kartice, pocetnaKartica, oznaciSnr }: Props) {
  const router = useRouter();
  const imaPoredak = d.poredak.length > 0;
  const [kartica, setKartica] = useState(
    pocetnaKartica && ["poredak", "parovi", "nasi", "start"].includes(pocetnaKartica)
      ? pocetnaKartica
      : kartice.length ? "nasi" : imaPoredak ? "poredak" : d.parovi.length ? "parovi" : "start"
  );
  const [kategorija, setKategorija] = useState("sve");
  const nasi = useMemo(() => new Set(nasiSnr), [nasiSnr]);

  // Uživo: osvježavaj tablice svake minute dok je stranica otvorena
  useEffect(() => {
    if (!zivo) return;
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, OSVJEZI_ZIVO_MS);
    return () => clearInterval(t);
  }, [zivo, router]);

  const katSnr = useMemo(() => new Map(d.sudionici.map((s) => [s.snr, s.kategorija])), [d.sudionici]);
  const kategorije = useMemo(() => {
    const s = new Set([...d.sudionici.map((x) => x.kategorija), ...d.poredak.map((x) => x.kategorija)].filter(Boolean));
    return [...s].sort(redKategorije);
  }, [d.sudionici, d.poredak]);
  const uKategoriji = (snr: number | null, kat?: string) =>
    kategorija === "sve" || (kat ?? (snr ? katSnr.get(snr) : "")) === kategorija;

  const poredak = d.poredak.filter((r) => uKategoriji(r.snr, r.kategorija));
  const parovi = d.parovi.filter((p) => uKategoriji(p.bijeli.snr) || uKategoriji(p.crni.snr));
  const start = d.sudionici.filter((s) => uKategoriji(s.snr, s.kategorija));

  const kola = Array.from({ length: Math.max(d.ukupnoKola || 0, d.koloParova) }, (_, i) => i + 1);
  const oznaka = (snr: number | null) => (snr && nasi.has(snr) ? "hl" : snr && snr === oznaciSnr ? "hl2" : "");

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <Link className="natrag" href="/">← Turniri</Link>
            {zivo && <span className="tag live">● Uživo{d.koloParova ? ` · ${d.koloParova}. kolo` : ""}</span>}
          </div>
          <h1 className="naslov-turnira">{ljepsiNaziv(d.naziv)}</h1>
          <div className="t-meta">
            {[d.info["Location"], datumi?.od ? (datumi.do && datumi.do !== datumi.od ? `${datum(datumi.od)} – ${datum(datumi.do)}` : datum(datumi.od)) : d.info["Date"],
              d.ukupnoKola ? `${d.ukupnoKola} kola` : null].filter(Boolean).join(" · ")}
          </div>
          {kategorijeDogadaja.length > 1 && (
            <div className="chips" role="group" aria-label="Kategorija prvenstva">
              {kategorijeDogadaja.map((k) => (
                <Link key={k.tnr} className="chip" aria-pressed={k.tnr === d.tnr} href={`/turnir/${k.tnr}${kartica === "nasi" ? "" : `?k=${kartica}`}`} replace>
                  {k.oznaka.charAt(0).toUpperCase() + k.oznaka.slice(1)}
                </Link>
              ))}
            </div>
          )}
          <div className="seg" role="tablist">
            {kartice.length > 0 && <button role="tab" aria-selected={kartica === "nasi"} onClick={() => setKartica("nasi")}>Naši igrači</button>}
            <button role="tab" aria-selected={kartica === "poredak"} onClick={() => setKartica("poredak")}>Poredak</button>
            <button role="tab" aria-selected={kartica === "parovi"} onClick={() => setKartica("parovi")}>Parovi</button>
            <button role="tab" aria-selected={kartica === "start"} onClick={() => setKartica("start")}>Igrači</button>
          </div>
          {kategorije.length > 1 && kartica !== "nasi" && (
            <div className="chips" role="group" aria-label="Kategorija">
              {["sve", ...kategorije].map((k) => (
                <button key={k} className="chip" aria-pressed={kategorija === k} onClick={() => setKategorija(k)}>{k === "sve" ? "Sve" : k}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="wrap sadrzaj">
        <section className="view">
          {kartica === "nasi" && kartice.map(({ igrac, kartica: k }) => (
            <article className="p" key={igrac.id}>
              <div className="p-head">
                <h2 className="p-name"><Link href={`/igrac/${igrac.id}`}>{igrac.ime}</Link></h2>
                {k.partije.some((p) => p.rezultat.trim()) && (
                  <div className="stat">
                    {k.mjesto && <span><b>{k.mjesto}.</b> mjesto</span>}
                    {k.bodovi && <span><b>{k.bodovi}</b> bod.</span>}
                  </div>
                )}
              </div>
              <div className="p-sub">
                {[k.performansa && k.performansa !== "0" ? `Performansa ${k.performansa}` : null, k.promjena ? `Rejting ${/^-/.test(k.promjena) ? "" : "+"}${k.promjena}` : null].filter(Boolean).join(" · ")}
              </div>
              <TablicaPartija partije={k.partije} tnr={d.tnr} />
            </article>
          ))}

          {kartica === "poredak" && (
            imaPoredak ? (
              <>
                {d.naslovPoretka && <p className="note">{prevedi(d.naslovPoretka)}</p>}
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th className="num">#</th><th>Igrač</th>{kategorije.length > 1 && <th>Kat.</th>}<th className="num">Rtg</th><th className="num">Bod.</th>{d.poredak[0]?.tb.slice(0, 2).map((_, i) => <th key={i} className="num">TB{i + 1}</th>)}</tr></thead>
                    <tbody>
                      {poredak.map((r) => (
                        <tr key={`${r.snr}-${r.ime}`} className={oznaka(r.snr)}>
                          <td className="num">{r.mjesto}</td>
                          <td>{r.titula && <span className="titula">{r.titula}</span>}{r.ime}{r.klub && <small className="sub">{r.klub}</small>}</td>
                          {kategorije.length > 1 && <td>{r.kategorija}</td>}
                          <td className="num">{r.rtg || "–"}</td>
                          <td className="num"><b>{r.bodovi}</b></td>
                          {r.tb.slice(0, 2).map((t, i) => <td key={i} className="num muted">{t}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <div className="empty">Poredak još nije objavljen.</div>
          )}

          {kartica === "parovi" && (
            <>
              {kola.length > 0 && (
                <div className="chips kola" role="group" aria-label="Kolo">
                  {kola.map((k) => (
                    <Link key={k} className="chip" aria-pressed={k === d.koloParova} href={`/turnir/${d.tnr}?k=parovi&kolo=${k}`} replace scroll={false}>{k}. kolo</Link>
                  ))}
                </div>
              )}
              {d.naslovKola && <p className="note">{prevedi(d.naslovKola)}</p>}
              {parovi.length ? (
                <div className="tbl-wrap">
                  <table className="tbl parovi">
                    <thead><tr><th className="num">St.</th><th>Bijeli</th><th className="num">Rez.</th><th>Crni</th></tr></thead>
                    <tbody>
                      {parovi.map((p) => (
                        <tr key={p.stol + p.bijeli.ime} className={oznaka(p.bijeli.snr) || oznaka(p.crni.snr)}>
                          <td className="num">{p.stol}</td>
                          <td>{p.bijeli.ime}<small className="sub">{[p.bijeli.rtg !== "0" ? p.bijeli.rtg : "", p.bijeli.bodovi && `${p.bijeli.bodovi} b`].filter(Boolean).join(" · ")}</small></td>
                          <td className="num rez"><span className="res n">{p.rezultat || "–"}</span></td>
                          <td>{p.crni.ime || "slobodan"}<small className="sub">{[p.crni.rtg !== "0" ? p.crni.rtg : "", p.crni.bodovi && `${p.crni.bodovi} b`].filter(Boolean).join(" · ")}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty">Parovi za ovo kolo još nisu objavljeni.</div>}
            </>
          )}

          {kartica === "start" && (
            start.length ? (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th className="num">Br.</th><th>Igrač</th>{kategorije.length > 1 && <th>Kat.</th>}<th className="num">Rtg</th></tr></thead>
                  <tbody>
                    {start.map((s) => (
                      <tr key={s.snr} className={oznaka(s.snr)}>
                        <td className="num">{s.snr}</td>
                        <td>{s.titula && <span className="titula">{s.titula}</span>}{s.ime}{s.klub && <small className="sub">{s.klub}</small>}</td>
                        {kategorije.length > 1 && <td>{s.kategorija}</td>}
                        <td className="num">{s.rtg || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty">Popis igrača još nije objavljen.</div>
          )}

          <p className="note">
            {zivo ? "Tablice se same osvježavaju svake minute. " : ""}
            Izvor: <a href={turnirUrl(d.tnr)} target="_blank" rel="noopener">chess-results.com</a>
          </p>
        </section>
      </main>
    </>
  );
}

// Naslovi s chess-results na hrvatski
function prevedi(s: string) {
  return s
    .replace(/Final Ranking after (\d+) Rounds/i, "Konačni poredak nakon $1 kola")
    .replace(/Ranking (?:list )?after Round (\d+)/i, "Poredak nakon $1. kola")
    .replace(/Rank after Round (\d+)/i, "Poredak nakon $1. kola")
    .replace(/Round (\d+) on (\d{4})\/(\d{2})\/(\d{2})(?: at (\d{1,2}:\d{2}))?/i, (_, k, y, m, d, h) => `${k}. kolo, ${+d}. ${+m}. ${y}.${h ? ` u ${h}` : ""}`);
}
