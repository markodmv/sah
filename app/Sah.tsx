"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dodajIgraca, ukloniIgraca } from "./actions";
import type { Igrac, Turnir } from "@/lib/sah/tipovi";
import { ljepsiNaziv } from "@/lib/sah/prikaz";

const DOBI: [string, string][] = [
  ["sve", "Svi"], ["mladi", "Mladi (sve)"], ["U8", "U08"], ["U10", "U10"], ["U12", "U12"], ["U14", "U14"],
  ["U16", "U16"], ["U18", "U18"], ["U20", "U20"], ["skole", "Škole"], ["zene", "Žene"], ["seniori", "Seniori"], ["open", "Open"],
];
const TEMPI: [string, string][] = [["sve", "Svi tempi"], ["standard", "♚ Standardni"], ["rapid", "♞ Ubrzani"], ["blitz", "♟ Brzopotezni"]];
const TEMPO_NAZIV: Record<string, string> = { standard: "Standardni", rapid: "Ubrzani", blitz: "Brzopotezni" };
const SKUPINA_NAZIV: Record<string, string> = { kadeti: "Kadeti", skole: "Škole", zene: "Žene", seniori: "Seniori", mladi: "Mladi" };
const MJESECI = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];
const DANI = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
const STARO_MS = 60 * 60_000; // starije od sat vremena → osvježi pri otvaranju

const danas = () => new Date().toISOString().slice(0, 10);
const plusDana = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const datum = (iso: string | null) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${+d}. ${+m}. ${y}.`; };
// Uvijek hrvatsko vrijeme (server na Vercelu radi u UTC-u)
const vrijeme = (iso: string) => new Date(iso).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function stanjeTurnira(t: Turnir) {
  const d = danas();
  if (t.datum_do && t.datum_do < d) return "past";
  if (t.datum_od && t.datum_od <= d && (!t.datum_do || t.datum_do >= d)) return "live";
  return "next";
}

function odgovaraDobi(t: Turnir, dob: string) {
  const g = t.skupine || [];
  if (dob === "sve") return true;
  if (dob === "mladi") return g.some((x) => /^U\d+$/.test(x) || ["kadeti", "skole", "mladi"].includes(x));
  if (["U8", "U10", "U12", "U14"].includes(dob)) return g.includes(dob) || (g.includes("kadeti") && !g.some((x) => /^U\d+$/.test(x)));
  return g.includes(dob);
}

// Odabrani filtri i kartica pamte se na uređaju (u memoriji ako localStorage nije dostupan)
const pamcenje = new Map<string, string>();
const slusaci = new Set<() => void>();
function usePamceno(kljuc: string, pocetno: string): [string, (v: string) => void] {
  const v = useSyncExternalStore(
    (cb) => { slusaci.add(cb); return () => { slusaci.delete(cb); }; },
    () => {
      if (!pamcenje.has(kljuc)) {
        try { pamcenje.set(kljuc, localStorage.getItem(kljuc) ?? pocetno); } catch { pamcenje.set(kljuc, pocetno); }
      }
      return pamcenje.get(kljuc)!;
    },
    () => pocetno
  );
  const postavi = (n: string) => {
    pamcenje.set(kljuc, n);
    try { localStorage.setItem(kljuc, n); } catch {}
    slusaci.forEach((f) => f());
  };
  return [v, postavi];
}

export default function Sah({ turniri, igraci, osvjezeno }: { turniri: Turnir[]; igraci: Igrac[]; osvjezeno: string | null }) {
  const router = useRouter();
  const [kartica, setKartica] = usePamceno("sah.kartica", "t");
  const [dob, setDob] = usePamceno("sah.dob", "sve");
  const [tempo, setTempo] = usePamceno("sah.tempo", "sve");
  const [trazi, setTrazi] = useState("");
  const [osvjezavam, setOsvjezavam] = useState(false);
  const [greskaOsvj, setGreskaOsvj] = useState<string | null>(null);

  const osvjezi = async () => {
    setOsvjezavam(true);
    setGreskaOsvj(null);
    try {
      const res = await fetch("/api/osvjezi", { method: "POST" });
      if (!res.ok) setGreskaOsvj("Osvježavanje nije uspjelo");
      router.refresh();
    } catch {
      setGreskaOsvj("Nema veze s internetom");
    }
    setOsvjezavam(false);
  };

  // Pri otvaranju: ako su podaci stari, osvježi sam
  const automatski = useRef(false);
  useEffect(() => {
    if (automatski.current) return;
    automatski.current = true;
    if (location.hash === "#igraci") setKartica("p");
    if (!osvjezeno || Date.now() - Date.parse(osvjezeno) > STARO_MS) setTimeout(osvjezi, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrirani = useMemo(() => {
    const q = trazi.trim().toLowerCase();
    return turniri
      .filter((t) => odgovaraDobi(t, dob) && (tempo === "sve" || t.vrsta === tempo))
      .filter((t) => !q || [t.naziv, t.mjesto, t.organizator].join(" ").toLowerCase().includes(q))
      .filter((t) => stanjeTurnira(t) !== "past" || (t.datum_do && t.datum_do >= plusDana(danas(), -7)))
      .sort((a, b) => (a.datum_od || "9999").localeCompare(b.datum_od || "9999") || a.naziv.localeCompare(b.naziv));
  }, [turniri, dob, tempo, trazi]);

  const poMjesecima = useMemo(() => {
    const m = new Map<string, Turnir[]>();
    for (const t of filtrirani) {
      const k = (t.datum_od || "").slice(0, 7) || "bez-datuma";
      m.set(k, [...(m.get(k) || []), t]);
    }
    return [...m];
  }, [filtrirani]);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <h1>Šah<span>.</span></h1>
            <div className="syncbox">
              <div className="sync">
                {osvjezavam ? "Osvježavam…" : greskaOsvj ? greskaOsvj : osvjezeno ? `Osvježeno ${vrijeme(osvjezeno)}` : ""}
              </div>
              <button className="refresh" type="button" onClick={osvjezi} disabled={osvjezavam}>↻ Osvježi</button>
            </div>
          </div>
          {kartica === "t" && (
            <>
              <input className="search" type="search" placeholder="Traži turnir, grad, klub…" autoComplete="off"
                value={trazi} onChange={(e) => setTrazi(e.target.value)} />
              <Cipovi stavke={DOBI} vrijednost={dob} promijeni={setDob} />
              <Cipovi stavke={TEMPI} vrijednost={tempo} promijeni={setTempo} klasa="tc" />
            </>
          )}
        </div>
      </header>

      <main className="wrap sadrzaj">
        {kartica === "t" ? (
          <section className="view">
            {!turniri.length ? (
              <div className="empty">{osvjezavam ? "Dohvaćam turnire s chess-results.com…" : "Još nema turnira. Dodirni ↻ Osvježi."}</div>
            ) : !filtrirani.length ? (
              <div className="empty">Nema turnira za odabrane filtre.</div>
            ) : (
              poMjesecima.map(([k, lista]) => (
                <div className="month" key={k}>
                  <h2>{k === "bez-datuma" ? "Bez datuma" : `${MJESECI[+k.slice(5) - 1]} ${k.slice(0, 4)}.`} · {lista.length}</h2>
                  <div className="list">{lista.map((t) => <KarticaTurnira key={t.tnr} t={t} igraci={igraci} />)}</div>
                </div>
              ))
            )}
            <p className="note">
              Izvor: <a href="https://chess-results.com/fed.aspx?lan=1&fed=CRO" target="_blank" rel="noopener">chess-results.com – federacija CRO</a>.
              Dodir na turnir otvara poredak, parove po kolima i igrače, po kategorijama.
            </p>
          </section>
        ) : (
          <section className="view">
            <DodajIgraca />
            <div className="list">
              {igraci.length ? igraci.map((p) => <KarticaIgraca key={p.id} p={p} />) : (
                <div className="empty">Još ne pratiš nijednog igrača. Upiši ime gore.</div>
              )}
            </div>
          </section>
        )}
      </main>

      <nav className="tabs" role="tablist">
        <div className="in">
          <button role="tab" aria-selected={kartica === "t"} onClick={() => { setKartica("t"); window.scrollTo(0, 0); }}><span>♜</span>Turniri</button>
          <button role="tab" aria-selected={kartica === "p"} onClick={() => { setKartica("p"); window.scrollTo(0, 0); }}><span>♚</span>Igrači</button>
        </div>
      </nav>
    </>
  );
}

function Cipovi({ stavke, vrijednost, promijeni, klasa = "" }: { stavke: [string, string][]; vrijednost: string; promijeni: (v: string) => void; klasa?: string }) {
  return (
    <div className="chips" role="group">
      {stavke.map(([v, l]) => (
        <button key={v} className={`chip ${klasa}`} aria-pressed={vrijednost === v} onClick={() => promijeni(v)}>{l}</button>
      ))}
    </div>
  );
}

function KarticaTurnira({ t, igraci }: { t: Turnir; igraci: Igrac[] }) {
  const st = stanjeTurnira(t);
  const d = t.datum_od ? new Date(t.datum_od + "T12:00:00Z") : null;
  const visednevni = t.datum_od && t.datum_do && t.datum_od !== t.datum_do;
  const dobne = (t.skupine || []).filter((g) => g !== "open").map((g) => SKUPINA_NAZIV[g] || g);
  const praceni = igraci.filter((p) => (p.prijave || []).some((u) => u.tnr === t.tnr));
  return (
    <Link className={`t ${st === "past" ? "past" : ""}`} href={`/turnir/${t.tnr}`}>
      <div className="date">{d ? <><b>{d.getUTCDate()}</b><small>{DANI[d.getUTCDay()]}</small></> : <b>–</b>}</div>
      <div className="t-body">
        <div className="t-name">{ljepsiNaziv(t.naziv)}</div>
        <div className="t-meta">{[t.mjesto, visednevni ? `${datum(t.datum_od)} – ${datum(t.datum_do)}` : ""].filter(Boolean).join(" · ")}</div>
        <div className="tags">
          {st === "live" && <span className="tag live">● Uživo</span>}
          {st === "past" && <span className="tag">Završen</span>}
          {dobne.map((a) => <span key={a} className="tag age">{a}</span>)}
          {t.vrsta && <span className="tag">{TEMPO_NAZIV[t.vrsta]}</span>}
          {t.tempo && <span className="tag mono">{t.tempo}</span>}
          {t.kola && <span className="tag mono">{t.kola} kola</span>}
          {praceni.map((p) => <span key={p.id} className="tag live">♚ {p.ime}</span>)}
        </div>
      </div>
    </Link>
  );
}

function DodajIgraca() {
  const [poruka, akcija, sprema] = useActionState(dodajIgraca, null);
  return (
    <form className="add" action={akcija}>
      <h2>Prati igrača</h2>
      <div className="row">
        <input className="search" name="ime" placeholder="Ime i prezime" required autoComplete="off" />
        <input className="search" name="fide" placeholder="FIDE ID (nije obavezno)" inputMode="numeric" autoComplete="off" />
      </div>
      <div className="row"><button className="btn" type="submit" disabled={sprema}>{sprema ? "Tražim igrača…" : "Dodaj"}</button></div>
      <p className={`note ${poruka ? "err" : ""}`}>{poruka || "FIDE ID, rejting, prijave i rezultate aplikacija pronađe sama."}</p>
    </form>
  );
}

const Promjena = ({ v }: { v?: number | null }) =>
  v ? <i className={v > 0 ? "up" : "down"}>{v > 0 ? "+" : ""}{v}</i> : <i>&nbsp;</i>;

function KarticaIgraca({ p }: { p: Igrac }) {
  const [potvrdi, setPotvrdi] = useState(false);
  const [uklanjam, startUklanjanje] = useTransition();
  const r = p.rejting || {}, d = p.promjena || {};
  return (
    <article className="p">
      <div>
        <h2 className="p-name">{p.titula ? `${p.titula} ` : ""}{p.ime}</h2>
        <div className="p-sub">{[p.fide_id ? `FIDE ${p.fide_id}` : null, p.godina_rodenja ? `rođ. ${p.godina_rodenja}` : null, p.federacija].filter(Boolean).join(" · ") || " "}</div>
      </div>
      <div className="ratings">
        <div className="r"><small>Standard</small><b>{r.std || "–"}</b><Promjena v={d.std} /></div>
        <div className="r"><small>Ubrzani</small><b>{r.rapid || "–"}</b><Promjena v={d.rapid} /></div>
        <div className="r"><small>Brzopotezni</small><b>{r.blitz || "–"}</b><Promjena v={d.blitz} /></div>
      </div>
      {p.napomena && <p className="note">{p.napomena}</p>}
      {p.prijave?.length > 0 && (
        <>
          <h3>Prijavljen na</h3>
          <ul className="mini">{p.prijave.map((u) => <li key={u.tnr}><Link href={`/turnir/${u.tnr}`}>{ljepsiNaziv(u.naziv)}</Link><span>{datum(u.od)}</span></li>)}</ul>
        </>
      )}
      {p.nedavno?.length > 0 && (
        <>
          <h3>Zadnji turniri</h3>
          <ul className="mini">{p.nedavno.map((u) => <li key={u.tnr}><Link href={`/turnir/${u.tnr}`}>{ljepsiNaziv(u.naziv)}</Link><span>{u.rezultat || datum(u.do)}</span></li>)}</ul>
        </>
      )}
      {p.fide_id && (
        <div className="links">
          <a href={`https://ratings.fide.com/profile/${p.fide_id}`} target="_blank" rel="noopener">FIDE profil</a>
          <Link href={`/igrac/${p.id}`}>Povijest turnira po godinama</Link>
        </div>
      )}
      {potvrdi ? (
        <div className="confirm">
          Prestati pratiti {p.ime}?
          <button className="btn danger" disabled={uklanjam} onClick={() => startUklanjanje(() => ukloniIgraca(p.id))}>{uklanjam ? "Uklanjam…" : "Ukloni"}</button>
          <button className="btn ghost" onClick={() => setPotvrdi(false)}>Odustani</button>
        </div>
      ) : (
        <div><button className="btn ghost" onClick={() => setPotvrdi(true)}>Prestani pratiti</button></div>
      )}
    </article>
  );
}
