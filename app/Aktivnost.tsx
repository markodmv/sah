"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const MINUTA = 60_000;
const NOVA_POSJETA_NAKON_MS = 30 * MINUTA;

// Bilježi koliko se aplikacija koristi: otkucaj svake minute dok je otvorena i vidljiva
export default function Aktivnost() {
  const putanja = usePathname();
  const javna = putanja.startsWith("/login") || putanja.startsWith("/registracija");

  useEffect(() => {
    if (javna) return;
    const otkucaj = () => {
      if (document.hidden) return;
      let nova = false;
      try {
        const zadnji = Number(localStorage.getItem("sah.otkucaj") || 0);
        // Najviše jedan otkucaj u minuti, i kad je aplikacija otvorena u više kartica
        if (Date.now() - zadnji < MINUTA - 5000) return;
        nova = Date.now() - zadnji > NOVA_POSJETA_NAKON_MS;
        localStorage.setItem("sah.otkucaj", String(Date.now()));
      } catch {}
      fetch("/api/aktivnost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nova }), keepalive: true }).catch(() => {});
    };
    otkucaj();
    const t = setInterval(otkucaj, MINUTA);
    const vidljivo = () => { if (!document.hidden) otkucaj(); };
    document.addEventListener("visibilitychange", vidljivo);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vidljivo); };
  }, [javna]);

  return null;
}
