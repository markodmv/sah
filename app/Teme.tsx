"use client";

import { useSyncExternalStore } from "react";

// Teme boja; izbor se pamti na uređaju (data-tema na <html>, vidi layout.tsx)
export const TEME = [
  { id: "zelena", naziv: "Turnirska zelena", boje: ["#0e6655", "#eef1f3"] },
  { id: "orah", naziv: "Drvena ploča", boje: ["#8a5a2b", "#f2eee8"] },
  { id: "plava", naziv: "Ponoćna plava", boje: ["#2456c8", "#eef1f7"] },
  { id: "bordo", naziv: "Bordo", boje: ["#9b2848", "#f4eff0"] },
  { id: "noc", naziv: "Noć i zlato", boje: ["#f2b134", "#0b0d0f"] },
] as const;

const slusaci = new Set<() => void>();
const trenutna = () => document.documentElement.dataset.tema || "zelena";

function postavi(id: string) {
  const html = document.documentElement;
  if (id === "zelena") delete html.dataset.tema;
  else html.dataset.tema = id;
  try { localStorage.setItem("sah.tema", id); } catch {}
  slusaci.forEach((f) => f());
}

export default function Teme() {
  const tema = useSyncExternalStore(
    (cb) => { slusaci.add(cb); return () => { slusaci.delete(cb); }; },
    trenutna,
    () => "zelena"
  );
  return (
    <section className="add teme">
      <h2>Izgled</h2>
      <div className="teme-izbor" role="radiogroup" aria-label="Tema boja">
        {TEME.map((t) => (
          <button key={t.id} role="radio" aria-checked={tema === t.id} className="tema" onClick={() => postavi(t.id)}>
            <span className="uzorak" style={{ background: `linear-gradient(135deg, ${t.boje[0]} 50%, ${t.boje[1]} 50%)` }} />
            {t.naziv}
          </button>
        ))}
      </div>
    </section>
  );
}
