import type { Prijavljeni } from "./izvori";

export type Rejting = { std?: number | null; rapid?: number | null; blitz?: number | null };

export type Turnir = {
  tnr: number; naziv: string; url: string; organizator: string | null; mjesto: string | null;
  datum_od: string | null; datum_do: string | null; kola: number | null; tempo: string | null;
  vrsta: "standard" | "rapid" | "blitz" | null; skupine: string[];
};

// Turnir kako se sprema: uz prikaz i startna lista te rezultati praćenih igrača
export type TurnirZapis = Turnir & {
  prijavljeni: Prijavljeni[];
  rezultati: Record<string, { mjesto: number | null; bodovi: string | null; od: number }>;
};

export type Igrac = {
  id: string; ime: string; fide_id: number | null; titula: string | null; godina_rodenja: number | null;
  federacija: string | null; rejting: Rejting; promjena: Rejting;
  prijave: { tnr: number; naziv: string; url: string; od: string | null }[];
  nedavno: { tnr: number; naziv: string; url: string; do: string | null; rezultat: string | null }[];
  napomena: string | null; azurirano: string | null;
};

export type Podaci = {
  turniri: TurnirZapis[];
  igraci: Igrac[];
  osvjezeno: string | null;
  pokrenuto: string | null;
  greska: string | null;
};
