// Službeni FIDE podaci preko Lichessovog FIDE sučelja (Lichess ih mjesečno preuzima s FIDE liste).
// ratings.fide.com ne odgovara ni Vercelovim ni GitHubovim serverima.
import { kljucImena } from "./izvori";

const API = "https://lichess.org/api/fide/player";

type LichessIgrac = {
  id: number; name: string; federation?: string; year?: number; title?: string;
  standard?: number; rapid?: number; blitz?: number;
};

async function dohvatiJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "sah-app (https://sah-app.vercel.app)", Accept: "application/json" },
      next: { revalidate: 6 * 3600 },
      signal: AbortSignal.timeout(15000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fideIgrac(fideId: number) {
  const z = await dohvatiJson<LichessIgrac>(`${API}/${fideId}`);
  if (!z?.id) return null;
  return {
    ime: z.name,
    rejting: { std: z.standard ?? null, rapid: z.rapid ?? null, blitz: z.blitz ?? null },
    godina: z.year ?? null,
    titula: z.title ?? null,
    federacija: z.federation === "CRO" ? "Hrvatska" : z.federation ?? null,
  };
}

// FIDE ID po imenu, samo ako je jednoznačan ("David Vašek" = "Vasek, David"); prednost hrvatskim igračima
export async function fideIdPoImenuFide(punoIme: string): Promise<number | null> {
  const rezultati = await dohvatiJson<LichessIgrac[]>(`${API}?q=${encodeURIComponent(punoIme)}`);
  if (!rezultati) return null;
  const trazi = kljucImena(punoIme);
  const isti = rezultati.filter((r) => kljucImena(r.name) === trazi);
  const cro = isti.filter((r) => r.federation === "CRO");
  if (cro.length === 1) return cro[0].id;
  if (!cro.length && isti.length === 1) return isti[0].id;
  return null;
}
